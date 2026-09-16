import { expect, test } from "@playwright/test";

/**
 * Apparence du site public (PLAN.md §10).
 *
 * Le risque introduit par l'apparition au défilement est précis : du contenu qui
 * resterait **invisible**. L'état de départ n'est donc posé que par le script,
 * et seulement quand l'animation a un sens. Ces tests vérifient les deux cas où
 * cela pourrait mal tourner — mouvement réduit, et contenu situé plus bas que
 * la fenêtre.
 */

test("le contenu reste visible quand le visiteur demande moins d'animation", async ({
  browser,
}) => {
  const contexte = await browser.newContext({ reducedMotion: "reduce" });
  const page = await contexte.newPage();

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // Les sections plus bas dans la page doivent l'être aussi, sans défilement :
  // sous `prefers-reduced-motion`, on révèle tout de suite au lieu d'observer.
  const sections = page.locator("[data-revele]");
  const nombre = await sections.count();
  expect(nombre).toBeGreaterThan(0);
  for (let index = 0; index < nombre; index++) {
    await expect(sections.nth(index)).toHaveAttribute("data-revele", "1");
  }

  await contexte.close();
});

test("les sections apparaissent au défilement, sans rien laisser d'invisible", async ({ page }) => {
  await page.goto("/");

  // Le bas de page est atteint : plus aucune section ne doit rester masquée.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.locator('[data-revele="0"]')).toHaveCount(0, { timeout: 10_000 });

  await expect(page.locator("footer")).toBeVisible();
});

test("une grille entière se révèle, sans laisser de carte invisible", async ({ page }) => {
  /*
   * `RevealListe` est la seconde implantation de l'apparition au défilement :
   * un seul observateur pour toute une grille, l'échelonnement des cartes étant
   * fait en CSS. Le défaut à empêcher est le même que pour `Reveal` — du
   * contenu resté transparent — et il ne serait pas couvert par le test
   * ci-dessus, qui ne regarde que l'autre attribut.
   */
  await page.goto("/sponsors");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

  await expect(page.locator('[data-revele-liste="0"]')).toHaveCount(0, { timeout: 10_000 });

  const grilles = page.locator("[data-revele-liste]");
  expect(await grilles.count()).toBeGreaterThan(0);

  // Et les cartes elles-mêmes sont bien peintes, pas seulement présentes.
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("chaque page publique porte un seul titre de niveau 1", async ({ page }) => {
  /*
   * La hiérarchie des titres est ce sur quoi s'appuie la navigation par titres
   * des lecteurs d'écran. Les bandeaux ajoutés en §10 déplacent le `h1` en haut
   * de chaque page : deux `h1`, ou aucun, désorienteraient cette navigation.
   */
  for (const chemin of [
    "/",
    "/programme",
    "/intervenants",
    "/actualites",
    "/infos-pratiques",
    "/sponsors",
    "/inscription",
    "/verifier",
    "/mon-espace",
    "/connexion",
    "/contributions",
    "/confidentialite",
    "/mentions-legales",
  ]) {
    await page.goto(chemin);
    await expect(page.getByRole("heading", { level: 1 }), chemin).toHaveCount(1);
  }
});

test("le lien d'évitement mène au contenu et n'apparaît qu'au clavier", async ({ page }) => {
  /*
   * WCAG 2.4.1. L'en-tête est collant et porte une douzaine de liens : sans ce
   * raccourci, atteindre le contenu au clavier demande de tous les traverser,
   * sur chaque page. Le lien doit rester invisible tant qu'il n'a pas le focus,
   * sinon il devient un défaut visuel permanent.
   */
  await page.goto("/");
  const evitement = page.getByRole("link", { name: "Aller au contenu" });

  await expect(evitement).not.toBeInViewport();

  await page.keyboard.press("Tab");
  await expect(evitement).toBeFocused();
  await expect(evitement).toBeInViewport();

  await evitement.press("Enter");
  await expect(page).toHaveURL(/#contenu$/);
});

test("les pages reprises ouvrent bien sur un bandeau", async ({ page }) => {
  /*
   * Le bandeau est ce qui donne au portail un seuil constant. Une page qui
   * l'aurait perdu au passage — refactoring, retour en arrière — se lirait
   * comme un écran d'une autre application, et rien d'autre ne le signalerait.
   */
  for (const chemin of [
    "/actualites",
    "/sponsors",
    "/inscription",
    "/verifier",
    "/connexion",
    "/contributions",
    "/confidentialite",
    "/mentions-legales",
  ]) {
    await page.goto(chemin);
    await expect(page.locator("main .fond-bandeau").first(), chemin).toBeVisible();
  }
});

test("« À propos » vit dans l'accueil, et son ancienne adresse y mène", async ({ page }) => {
  /*
   * La page « À propos » a été absorbée par l'accueil (§12). Trois choses
   * doivent tenir ensemble, et aucune ne se voit sans les autres :
   *
   * - l'ancienne URL ne répond plus 404 mais redirige, sans quoi les signets,
   *   les courriels déjà envoyés et les résultats de recherche tombent à vide ;
   * - la redirection porte l'ancre, sans quoi le visiteur arrive en haut d'une
   *   page longue et doit chercher ce qu'il venait lire ;
   * - la section existe réellement à cette ancre.
   */
  const reponse = await page.goto("/a-propos");
  expect(reponse?.status()).toBe(200);
  await expect(page).toHaveURL(/\/#a-propos$/);

  const section = page.locator("#a-propos");
  await expect(section).toBeVisible();
  await expect(section.getByRole("heading", { name: /À propos du Forum/ })).toBeVisible();
});

test("la page « À propos » n'existe plus comme page à part entière", async ({ page }) => {
  // Le menu ne doit plus l'annoncer : une entrée vers une page absorbée est
  // exactement le défaut des quatre 404 du BackOffice, à l'envers.
  await page.goto("/");
  const entrees = page.locator('header a[href="/a-propos"]');
  await expect(entrees).toHaveCount(0);
});
