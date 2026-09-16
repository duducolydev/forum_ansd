import { expect, test } from "@playwright/test";
import { prisma } from "../src/lib/db";
import { seConnecterAdmin } from "./helpers/comptes";

/**
 * Paramétrage du portail (PLAN.md §8).
 *
 * Ce qui est vérifié ici n'est pas que les formulaires s'affichent, mais que
 * les réglages **produisent un effet** : un guichet fermé refuse réellement une
 * inscription, une couleur non conforme est réellement rejetée, une section
 * ajoutée apparaît réellement sur la page d'accueil.
 */

/** Rétablit les réglages d'origine, quoi qu'il arrive au test. */
async function avecReglages<T>(
  remplacement: Record<string, unknown>,
  travail: () => Promise<T>,
): Promise<T> {
  const edition = await prisma.edition.findFirstOrThrow({ where: { isActive: true } });
  const avant = edition.settings;
  try {
    await prisma.edition.update({
      where: { id: edition.id },
      data: { settings: { ...(avant as object), ...remplacement } as object },
    });
    return await travail();
  } finally {
    await prisma.edition.update({
      where: { id: edition.id },
      data: { settings: avant as object },
    });
  }
}

/**
 * Sections de l'accueil : on **relève** l'état de départ, on ne l'efface pas.
 *
 * Défaut fermé ici, et il était grave. La version précédente vidait la table
 * avant **et** après, pour pouvoir compter un nombre exact de cartes. Sur une
 * instance de démonstration vide, c'était sans conséquence. Sur une instance
 * réellement utilisée, chaque exécution de la suite détruisait la composition
 * de la page d'accueil — sections écrites en BackOffice comprises. Un test n'a
 * pas à supprimer le travail de quelqu'un pour se simplifier une assertion.
 *
 * Le point de départ est donc relevé, jamais imposé : le test n'affirme plus un
 * nombre absolu mais une **variation**, ce qui est de toute façon la propriété
 * qui compte — ajouter une section ne doit pas faire disparaître les autres.
 */
let idsAvant: string[] = [];

test.beforeAll(async () => {
  const existantes = await prisma.pageSection.findMany({
    where: { page: "accueil" },
    select: { id: true },
  });
  idsAvant = existantes.map((section) => section.id);
});

test.afterAll(async () => {
  /*
   * Seules les sections nées pendant le test sont retirées.
   *
   * Cas particulier : si la table était vide au départ, la première création a
   * aussi matérialisé la composition d'origine. On rend alors la table vide,
   * pour que l'exécution suivante retrouve les mêmes conditions.
   */
  if (idsAvant.length === 0) {
    await prisma.pageSection.deleteMany({ where: { page: "accueil" } });
  } else {
    await prisma.pageSection.deleteMany({
      where: { page: "accueil", id: { notIn: idsAvant } },
    });
  }
  await prisma.$disconnect();
});

test("l'écran des paramètres s'ouvre et annonce l'état du guichet", async ({ page }) => {
  await seConnecterAdmin(page);
  const reponse = await page.goto("/admin/parametres");
  expect(reponse?.status()).toBe(200);

  await expect(page.getByRole("heading", { name: "Paramètres" })).toBeVisible();
  await expect(page.getByText(/État aujourd'hui/)).toBeVisible();

  for (const chemin of [
    "/admin/parametres/categories",
    "/admin/parametres/roles",
    "/admin/parametres/sections",
  ]) {
    const sous = await page.goto(chemin);
    expect(sous?.status(), chemin).toBe(200);
  }
});

test("un guichet fermé remplace le formulaire par son message, dans les deux langues", async ({
  page,
}) => {
  await avecReglages(
    {
      inscriptions: {
        active: false,
        ouvertureLe: "",
        fermetureLe: "",
        messageFermeFr: "Guichet clos pour le test.",
        messageFermeEn: "Desk closed for the test.",
      },
    },
    async () => {
      await page.goto("/inscription");
      await expect(page.getByText("Guichet clos pour le test.")).toBeVisible();
      // Le formulaire ne doit pas être proposé : cinq étapes pour un refus.
      // Le champ du formulaire s'appelle « Nom » ; `exact` évite qu'il se
      // confonde avec « Prénom », que `getByLabel` retiendrait sinon.
      await expect(page.getByLabel("Nom", { exact: true })).toHaveCount(0);

      await page
        .context()
        .addCookies([{ name: "NEXT_LOCALE", value: "en", url: "http://localhost:3010" }]);
      await page.goto("/inscription");
      await expect(page.getByText("Desk closed for the test.")).toBeVisible();
      await page.context().clearCookies();
    },
  );

  // Rouvert, le formulaire revient.
  await page.goto("/inscription");
  await expect(page.getByLabel("Nom", { exact: true })).toBeVisible();
});

test("le thème refuse une couleur sous le seuil et applique celles qui passent", async ({
  page,
}) => {
  await seConnecterAdmin(page);
  await page.goto("/admin/parametres");

  const apparence = page.locator("section").filter({ hasText: "Apparence" });
  const champPrimaire = apparence.getByLabel("Couleur d'action (boutons) — code hexadécimal");

  /*
   * Un gris moyen (#808080) est le cas qui échoue vraiment : le texte posé
   * dessus étant **calculé** — le meilleur du blanc ou de l'encre —, la plupart
   * des couleurs vives passent. Seule une luminance intermédiaire met les deux
   * candidats sous le seuil, et c'est précisément ce que le contrôle doit
   * attraper.
   */
  await champPrimaire.fill("#808080");
  await expect(apparence.getByText(/sous le minimum de/).first()).toBeVisible();

  // Le refus va jusqu'au serveur : le formulaire n'est pas seul à décider.
  await apparence.getByRole("button", { name: "Enregistrer" }).click();
  await expect(apparence.getByText(/sous le minimum de 4,50:1/)).toBeVisible();

  // Une couleur conforme s'enregistre et atteint réellement la page publique.
  await champPrimaire.fill("#1d5a9c");
  await apparence.getByRole("button", { name: "Enregistrer" }).click();
  await expect(apparence.getByText("Thème enregistré.")).toBeVisible();

  await page.goto("/");
  const css = await page.locator("#theme-edition").textContent();
  expect(css).toContain("--primary: #1d5a9c");

  // Remise à la couleur d'origine, pour ne pas laisser le site repeint.
  await page.goto("/admin/parametres");
  await apparence.getByLabel("Couleur d'action (boutons) — code hexadécimal").fill("#1d8247");
  await apparence.getByRole("button", { name: "Enregistrer" }).click();
  await expect(apparence.getByText("Thème enregistré.")).toBeVisible();
});

test("une section ajoutée puis affichée apparaît sur la page d'accueil", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto("/admin/parametres/sections");

  await page.getByLabel("Type").selectOption("appel");
  await page.getByRole("button", { name: "Ajouter" }).click();
  await expect(page.getByText(/Section ajoutée/)).toBeVisible();

  // L'attribut est porté par la carte elle-même, pas par un descendant.
  const carte = page.locator('[data-testid="carte-section"][data-type="appel"]');
  await carte.getByLabel("Titre (français)").fill("Rejoignez le Forum");
  /*
   * Zone d'édition mise en forme (§17) : visée par son rôle et son nom exact.
   * `getByLabel` trouve aussi la barre d'outils, nommée « Mise en forme — … »
   * pour distinguer celle du français de celle de l'anglais.
   */
  await carte
    .getByRole("textbox", { name: "Phrase d'accompagnement (français)", exact: true })
    .fill("Les places sont limitées.");
  await carte.getByLabel("Afficher sur le site").check();
  await carte.getByRole("button", { name: "Enregistrer" }).click();
  await expect(carte.getByText("Section enregistrée.")).toBeVisible();

  /*
   * La garantie qui manquait : ajouter une section pour l'essayer effaçait
   * l'accueil entier.
   *
   * Elle s'exprime en variation, pas en nombre absolu. Sur une installation
   * neuve, la première création matérialise la composition d'origine : on doit
   * donc retrouver le bandeau, le texte et les actualités **en plus** de la
   * section ajoutée. Sur une installation déjà utilisée, rien de ce qui existait
   * ne doit avoir disparu.
   */
  await expect(page.locator('[data-testid="carte-section"][data-type="appel"]')).toHaveCount(1);

  const attendus = idsAvant.length === 0 ? ["hero", "texte", "actualites"] : [];
  for (const type of attendus) {
    await expect(
      page.locator(`[data-testid="carte-section"][data-type="${type}"]`).first(),
    ).toBeVisible();
  }

  const total = await page.getByTestId("carte-section").count();
  expect(total, "aucune section préexistante ne doit avoir disparu").toBeGreaterThanOrEqual(
    Math.max(idsAvant.length, attendus.length) + 1,
  );

  /*
   * Sur le site, la section ajoutée s'affiche sans que le reste ait disparu.
   * Le bandeau est le repère le plus sûr : il ouvre la page dans les deux cas,
   * composition matérialisée comme composition déjà en place.
   */
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Rejoignez le Forum" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

/*
 * Ce test passe par l'écran et non par la base.
 *
 * Le pied de page lit des réglages mis en cache soixante secondes, et c'est
 * l'action serveur qui invalide ce cache. Écrire en base directement, comme le
 * font les tests du guichet, laisserait l'ancien pied affiché — non pas parce
 * que le produit est faux, mais parce que le raccourci contourne le mécanisme
 * même que l'on prétend vérifier.
 */
test("le pied de page reprend les coordonnées paramétrées", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto("/admin/parametres");

  const bloc = page.locator("section").filter({ hasText: "Pied de page" });
  await bloc.getByLabel("Mention de bas de page").fill("© test E2E");
  await bloc.getByLabel("Courriel de contact").fill("contact-test@example.test");
  await bloc.getByLabel("LinkedIn").fill("https://www.linkedin.com/company/ansd");
  await bloc.getByRole("button", { name: "Enregistrer" }).click();
  await expect(bloc.getByText("Pied de page enregistré.")).toBeVisible();

  await page.goto("/");
  const pied = page.locator("footer");
  await expect(pied.getByText("© test E2E")).toBeVisible();
  await expect(pied.getByRole("link", { name: "LinkedIn" })).toBeVisible();
  await expect(pied.getByRole("link", { name: "contact-test@example.test" })).toBeVisible();

  // Remise en état : les tests suivants et le site partagent cette base.
  await page.goto("/admin/parametres");
  await bloc.getByLabel("Mention de bas de page").fill("© 2026 ANSD");
  await bloc.getByLabel("Courriel de contact").fill("");
  await bloc.getByLabel("LinkedIn").fill("");
  await bloc.getByRole("button", { name: "Enregistrer" }).click();
  await expect(bloc.getByText("Pied de page enregistré.")).toBeVisible();
});

test("une illustration déposée dans une section apparaît sur le site", async ({
  page,
  request,
}) => {
  /*
   * Le dépôt se fait dans **le formulaire de la section**, donc au même
   * « Enregistrer » que le reste. Ce test n'appuie sur aucun autre bouton : si
   * l'image reprenait un formulaire à part, avec son propre envoi, il
   * échouerait — c'est exactement le défaut qui avait fait perdre le logo de la
   * Banque mondiale (§11.7).
   */
  await seConnecterAdmin(page);
  await page.goto("/admin/parametres/sections");

  await page.getByLabel("Type").selectOption("appel");
  await page.getByRole("button", { name: "Ajouter" }).click();
  await expect(page.getByText(/Section ajoutée/)).toBeVisible();

  /*
   * `.last()` et non le sélecteur nu : le test précédent de ce fichier a déjà
   * créé une section « appel », et les deux coexistent jusqu'au nettoyage de
   * fin. La dernière carte est celle qu'on vient d'ajouter, puisqu'une nouvelle
   * section reçoit le rang le plus élevé.
   */
  const carte = page.locator('[data-testid="carte-section"][data-type="appel"]').last();
  await carte.getByLabel("Titre (français)").fill("Avec une image");
  await carte.getByLabel("Texte alternatif de l'illustration (français)").fill("Un carré bleu");
  await carte.getByLabel("Afficher sur le site").check();
  await carte.locator('input[type="file"]').setInputFiles({
    name: "illustration.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    ),
  });
  await carte.getByRole("button", { name: "Enregistrer" }).click();
  await expect(carte.getByText("Section enregistrée.")).toBeVisible();

  // L'aperçu est servi par la route contrôlée, pas par un blob local.
  const apercu = carte.locator('img[src*="/image"]');
  await expect(apercu).toBeVisible();

  const source = await apercu.getAttribute("src");
  const reponse = await request.get(source!);
  expect(reponse.status()).toBe(200);
  expect(reponse.headers()["content-type"]).toContain("image/png");
  expect(reponse.headers()["x-content-type-options"]).toBe("nosniff");

  // Et sur le site, avec son texte alternatif.
  await page.goto("/");
  await expect(page.getByAltText("Un carré bleu")).toBeVisible();
});

test("une illustration se retire sans toucher au reste de la section", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto("/admin/parametres/sections");

  // Même carte que le test précédent : celle ajoutée en dernier.
  const carte = page.locator('[data-testid="carte-section"][data-type="appel"]').last();
  await carte.getByLabel(/Retirer à l/).check();
  await carte.getByRole("button", { name: "Enregistrer" }).click();
  await expect(carte.getByText("Section enregistrée.")).toBeVisible();

  await expect(carte.locator('img[src*="/image"]')).toHaveCount(0);
  // Le titre saisi au test précédent est toujours là : retirer l'image ne
  // réinitialise pas la section.
  await expect(carte.getByLabel("Titre (français)")).toHaveValue("Avec une image");
});
