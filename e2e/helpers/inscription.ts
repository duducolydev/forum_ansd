import { expect, type Page } from "@playwright/test";

/*
 * Parcours du formulaire public d'inscription, partagés par les tests qui le
 * remplissent (inscription libre, inscription sur invitation).
 */

/**
 * Numéro d'étape courant, lu sur l'indicateur « Étape N sur M » du formulaire.
 * C'est la seule source fiable de progression : le nombre d'étapes varie selon
 * la catégorie choisie (l'étape logistique n'apparaît pas pour tout le monde).
 */
export async function etapeCourante(page: Page): Promise<{ numero: number; total: number }> {
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
export async function allerJusquAuBout(page: Page): Promise<void> {
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
export async function accepterConsentements(page: Page): Promise<void> {
  const conditions = page.getByLabel(/J'accepte les conditions/);
  const donnees = page.getByLabel(/Je consens à la collecte/);

  // `click()` et non `check()` : `check()` relit l'état aussitôt après avoir
  // cliqué et reclique s'il ne le voit pas encore coché. Sur une case pilotée
  // par l'état React, la mise à jour arrive après cette relecture — `check()`
  // rebascule alors la case indéfiniment et finit par expirer.
  await conditions.click();
  await expect(conditions).toBeChecked();

  await donnees.click();
  await expect(donnees).toBeChecked();
}
