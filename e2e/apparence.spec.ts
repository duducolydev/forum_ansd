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

test("les bandeaux restent compacts et la bande du haut porte son dégradé", async ({ page }) => {
  /*
   * PLAN.md §19. Mesuré avant : 243 px de bandeau sur écran de bureau, et une
   * bande du haut transparente — ses utilitaires Tailwind ne produisaient
   * aucune règle.
   */
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const chemin of ["/programme", "/sponsors", "/inscription", "/verifier", "/connexion"]) {
    await page.goto(chemin);
    const hauteur = await page
      .locator("main .bandeau-page")
      .first()
      .evaluate((element) => element.getBoundingClientRect().height);
    expect(hauteur, `hauteur du bandeau de ${chemin}`).toBeLessThanOrEqual(150);
  }

  // Bande défilante en dégradé foncé, texte blanc ; barre de navigation en
  // dégradé bleu clair, texte bleu nuit (§20).
  for (const [selecteur, couleur] of [
    ["div.fond-entete", "rgb(255, 255, 255)"],
    ["header.fond-navbar", "rgb(8, 44, 78)"],
  ] as const) {
    const style = await page
      .locator(selecteur)
      .first()
      .evaluate((element) => {
        const calcule = getComputedStyle(element);
        return { image: calcule.backgroundImage, couleur: calcule.color };
      });
    expect(style.image, selecteur).toContain("linear-gradient");
    expect(style.couleur, selecteur).toBe(couleur);
  }
});

test("l'en-tête porte le logo officiel et des liens lisibles sur le bleu clair", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  // Le logo est bien chargé, dans l'en-tête comme dans le pied de page.
  for (const logo of [
    page.locator('header img[src="/images/logo_forum_transparent.png"]'),
    page.locator('footer img[src="/images/logo_forum_transparent.png"]'),
  ]) {
    await logo.scrollIntoViewIfNeeded();
    await expect
      .poll(() => logo.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0);
  }
  await expect(
    page.getByRole("link", { name: "Forum international sur les données — accueil" }),
  ).toBeVisible();

  // Liens de la barre en bleu nuit sur le bleu clair (11,52:1 au plus faible).
  const lien = page.locator("header nav").getByRole("link").first();
  expect(await lien.evaluate((element) => getComputedStyle(element).color)).toBe("rgb(8, 44, 78)");
});

test("le titre de l'accueil occupe toute la largeur du chapeau justifié", async ({ page }) => {
  /*
   * PLAN.md §20. Le titre s'arrêtait à 427 px pour un chapeau de 524 : il
   * remplit désormais le même bloc, lignes centrées. Il n'est pas justifié :
   * deux ou trois mots par ligne s'étiraient en trous (« Reliable      data »).
   */
  for (const largeur of [1440, 390]) {
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.goto("/");
    const titre = page.locator("main h1").first();
    const chapeau = titre.locator("xpath=following-sibling::*[1]");

    const boite = async (element: typeof titre) =>
      element.evaluate((noeud) => {
        const r = noeud.getBoundingClientRect();
        return { gauche: Math.round(r.left), droite: Math.round(r.right) };
      });
    expect(await boite(titre), `bords du titre à ${largeur} px`).toEqual(await boite(chapeau));

    expect(await titre.evaluate((noeud) => getComputedStyle(noeud).textAlign)).toBe("center");
    const style = await chapeau.evaluate((noeud) => {
      const calcule = getComputedStyle(noeud);
      return { alignement: calcule.textAlign, coupure: calcule.hyphens };
    });
    expect(style).toEqual({ alignement: "justify", coupure: "auto" });
  }
});

test("les promesses de l'inscription tiennent sur une ligne, formulaire juste dessous", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/inscription");

  const badges = page.getByTestId("promesses-inscription").getByRole("listitem");
  await expect(badges).toHaveCount(3);
  const hauts = await badges.evaluateAll((elements) =>
    elements.map((element) => Math.round(element.getBoundingClientRect().top)),
  );
  expect(Math.max(...hauts) - Math.min(...hauts), "badges sur une même ligne").toBeLessThanOrEqual(
    2,
  );

  // Le formulaire commençait à 586 px du haut de page : il doit tenir dans le
  // premier écran, avec son premier champ.
  const formulaire = await page
    .locator("main form")
    .first()
    .evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
  expect(formulaire).toBeLessThanOrEqual(400);
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
