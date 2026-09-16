import { expect, test, type Page } from "@playwright/test";
import { prisma } from "../src/lib/db";
import { emailE2E, seConnecterAdmin } from "./helpers/comptes";
import { nettoyerDonneesE2E } from "./helpers/nettoyage";
import { pngUni } from "./helpers/image";

/**
 * Le parcours nommé par le **critère de sortie du Lot 1** :
 * inscription → confirmation → badge, puis contrôle du badge à l'entrée.
 *
 * Les étapes sont jouées en série et dans l'ordre : chacune part de l'état
 * laissé par la précédente, exactement comme un participant réel. Un échec
 * désigne alors précisément le maillon rompu.
 *
 * C'est ce scénario qui a mis au jour le défaut de soumission du formulaire
 * public (TODO T32) : aucune inscription ne pouvait aboutir depuis un
 * navigateur, et rien d'autre ne le signalait.
 */
test.describe.configure({ mode: "serial" });

const EMAIL = emailE2E("parcours");
const PRENOM = "Awa";
const NOM = "Diagne";
/**
 * Catégorie sans étape logistique (parcours en quatre étapes, celui du
 * signalement) **et** à validation manuelle, pour exercer la confirmation par
 * le comité à l étape 4.
 */
const CATEGORIE = "Sponsor";

let publicId = "";

test.afterAll(async () => {
  await nettoyerDonneesE2E();
  await prisma.$disconnect();
});

/**
 * Numéro d'étape courant, lu sur l'indicateur « Étape N sur M » du formulaire.
 * C'est la seule source fiable de progression : le nombre d'étapes varie selon
 * la catégorie choisie (l'étape logistique n'apparaît pas pour tout le monde).
 */
async function etapeCourante(page: Page): Promise<{ numero: number; total: number }> {
  const texte = await page.getByText(/Étape \d+ sur \d+/).innerText();
  const [, numero, total] = texte.match(/Étape (\d+) sur (\d+)/)!;
  return { numero: Number(numero), total: Number(total) };
}

/**
 * Avance jusqu'à la dernière étape.
 *
 * La progression est pilotée par l'indicateur d'étape et non par la visibilité
 * du bouton d'envoi : `isVisible()` est un contrôle **instantané, sans
 * réessai**, qui répondait faux pendant le re-rendu de React. Le test cliquait
 * alors « Continuer » sur une étape où ce bouton n'existait plus, et expirait.
 */
async function allerJusquAuBout(page: Page): Promise<void> {
  for (let garde = 0; garde < 10; garde++) {
    const { numero, total } = await etapeCourante(page);
    if (numero >= total) return;

    await page.getByRole("button", { name: "Continuer" }).click();

    // Attente **avec réessai** du changement d'étape. Si la validation d'étape
    // refuse, on remonte le message affiché plutôt qu'un timeout muet.
    try {
      await expect
        .poll(async () => (await etapeCourante(page)).numero, { timeout: 5_000 })
        .toBeGreaterThan(numero);
    } catch {
      const message = await page.locator("p.text-danger-text").first().textContent();
      throw new Error(`Bloqué à l'étape ${numero}/${total} — message : ${message ?? "aucun"}`);
    }
  }
  throw new Error("Étape finale jamais atteinte.");
}

/**
 * Coche les deux consentements obligatoires **et attend confirmation**.
 *
 * `check()` rend la main dès qu'il a cliqué ; l'état de la case peut n'être
 * stabilisé qu'un instant plus tard. Soumettre sans attendre envoyait un
 * formulaire dont les consentements étaient absents — et le test accusait à
 * tort la validation du serveur. `toBeChecked()` réessaie jusqu'à ce que l'état
 * soit réellement acquis.
 */
async function accepterConsentements(page: Page): Promise<void> {
  const conditions = page.getByLabel(/J'accepte les conditions/);
  const donnees = page.getByLabel(/Je consens au traitement/);

  // `click()` et non `check()` : `check()` relit l'état aussitôt après avoir
  // cliqué et reclique s'il ne le voit pas encore coché. Sur une case pilotée
  // par l'état React, la mise à jour arrive après cette relecture — `check()`
  // rebascule alors la case indéfiniment et finit par expirer.
  await conditions.click();
  await expect(conditions).toBeChecked();

  await donnees.click();
  await expect(donnees).toBeChecked();
}

test("1. un visiteur s'inscrit depuis le formulaire public", async ({ page }) => {
  await page.goto("/inscription");

  await page.getByLabel("Prénom", { exact: true }).fill(PRENOM);
  await page.getByLabel("Nom", { exact: true }).fill(NOM);
  await page.getByLabel("Adresse e-mail", { exact: true }).fill(EMAIL);
  await page.getByLabel("Pays", { exact: true }).fill("Mali");
  await page.getByLabel("Catégorie de participation").selectOption({ label: CATEGORIE });

  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByLabel("Organisation", { exact: true }).fill("INSTAT");
  await page.getByLabel("Fonction", { exact: true }).fill("Directeur des statistiques");

  // Photo de badge : image volontairement rectangulaire, pour que le recadrage
  // carré ait quelque chose à faire.
  await page.locator('input[type="file"]').setInputFiles({
    name: "photo.png",
    mimeType: "image/png",
    buffer: pngUni(240, 160, [200, 40, 60]),
  });
  // Le canvas d'aperçu n'apparaît qu'une fois l'image décodée et cadrée.
  await expect(page.getByRole("img", { name: /Aperçu du cadrage/ })).toBeVisible();

  await allerJusquAuBout(page);

  await accepterConsentements(page);
  await page.getByRole("button", { name: "Envoyer mon inscription" }).click();

  await expect(page.getByText("Inscription enregistrée")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/en attente de validation/)).toBeVisible();
});

test("2. l'inscription est enregistrée avec des consentements horodatés", async () => {
  const edition = await prisma.edition.findFirstOrThrow({ where: { isActive: true } });
  const participant = await prisma.participant.findUniqueOrThrow({
    where: { editionId_email: { editionId: edition.id, email: EMAIL } },
  });

  publicId = participant.publicId;

  expect(participant.status).toBe("REGISTERED");
  expect(participant.source).toBe("ONLINE");
  expect(participant.consentTerms).toBe(true);
  expect(participant.consentData).toBe(true);
  // Non cochée : elle ne doit pas se retrouver acceptée par effet de bord.
  expect(participant.consentImage).toBe(false);
  expect(participant.consentAt).not.toBeNull();
  // Identifiant public non séquentiel (brief §5.4).
  expect(participant.publicId).toMatch(/^FID26-[A-Z0-9]{6}$/);

  // La photo recadrée par le navigateur a suivi l'inscription, et le serveur
  // l'a acceptée après vérification de ses octets — elle est donc réencodée en
  // JPEG par le canvas, quel que soit le format déposé.
  expect(participant.photoPath).toMatch(
    new RegExp(`^photos/${participant.publicId}-[0-9a-f]{12}\.jpg$`),
  );
});

test("3. une seconde inscription avec le même e-mail est refusée", async ({ page }) => {
  await page.goto("/inscription");

  await page.getByLabel("Prénom", { exact: true }).fill(PRENOM);
  await page.getByLabel("Nom", { exact: true }).fill(NOM);
  await page.getByLabel("Adresse e-mail", { exact: true }).fill(EMAIL);
  await page.getByLabel("Pays", { exact: true }).fill("Mali");
  await page.getByLabel("Catégorie de participation").selectOption({ label: CATEGORIE });

  await allerJusquAuBout(page);
  await accepterConsentements(page);
  await page.getByRole("button", { name: "Envoyer mon inscription" }).click();

  // Le doublon oriente vers le lien magique plutôt que de créer un second
  // dossier — c'est le comportement attendu, pas une erreur technique.
  await expect(page.getByText(/déjà inscrite/)).toBeVisible({ timeout: 20_000 });
});

test("4. le comité confirme l'inscription depuis le BackOffice", async ({ page }) => {
  await seConnecterAdmin(page);

  await page.goto(`/admin/participants?q=${encodeURIComponent(EMAIL)}`);

  // La recherche doit ramener exactement le participant créé à l'étape 1.
  await expect(page.getByText(`${PRENOM} ${NOM}`)).toBeVisible();
  await page.getByRole("link", { name: "Ouvrir" }).first().click();

  await expect(page.getByText(publicId)).toBeVisible();
  await page.getByRole("button", { name: "Confirmer" }).click();

  await expect(page.getByText("Confirmé", { exact: true }).first()).toBeVisible({
    timeout: 20_000,
  });
});

test("5. le badge est généré et téléchargeable", async ({ page }) => {
  await seConnecterAdmin(page);

  const participant = await prisma.participant.findFirstOrThrow({
    where: { publicId },
    select: { id: true },
  });
  await page.goto(`/admin/participants/${participant.id}`);

  await page.getByRole("button", { name: /Générer le badge|Régénérer/ }).click();

  /*
   * On attend les **fichiers**, pas le libellé « v1 ».
   *
   * La ligne de badge apparaît dès sa création, avant le rendu : la confirmation
   * du participant met un job `badge.generate` en file, et notre clic peut donc
   * trouver la ligne déjà créée par le worker qui, lui, est encore en train de
   * rendre. L'écran le dit correctement (« en attente de génération », sans lien
   * PDF) ; c'est le test qui se contentait d'un signe trop précoce et échouait
   * dès que le rendu prenait quelques secondes de plus — conteneur redémarré,
   * Chromium à froid.
   */
  await expect
    .poll(
      async () => {
        const ligne = await prisma.badge.findFirst({
          where: { participantId: participant.id, revokedAt: null },
          select: { pdfPath: true, pngPath: true },
        });
        return Boolean(ligne?.pdfPath && ligne.pngPath);
      },
      { timeout: 60_000, message: "les fichiers du badge n'ont pas été écrits" },
    )
    .toBe(true);

  const badge = await prisma.badge.findFirstOrThrow({
    where: { participantId: participant.id, revokedAt: null },
  });

  // Le PDF doit être réellement servi, pas seulement référencé en base.
  const pdf = await page.request.get(`/api/v1/badges/${badge.id}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
});

test("6. le badge se vérifie publiquement, sans donnée superflue", async ({ page }) => {
  await page.goto(`/verifier?id=${publicId}`);

  await expect(page.getByText(/Badge valide|Identifiant reconnu/)).toBeVisible();
  await expect(page.getByText(NOM.toUpperCase())).toBeVisible();
  await expect(page.getByText("INSTAT")).toBeVisible();

  // Brief §2.11 : jamais d'e-mail ni de téléphone sur la page publique.
  const contenu = await page.content();
  expect(contenu).not.toContain(EMAIL);
});

test("7. un identifiant inconnu n'est pas reconnu", async ({ page }) => {
  await page.goto("/verifier?id=FID26-ZZZZZZ");
  await expect(page.getByText("Badge non reconnu")).toBeVisible();
});
