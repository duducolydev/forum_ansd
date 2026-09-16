import { expect, test } from "@playwright/test";

/**
 * Gardes de sécurité.
 *
 * Ce fichier est né de deux régressions réelles, introduites en ajoutant les
 * en-têtes de sécurité et passées au travers du typecheck, du lint et de
 * 87 tests : `/admin` n'était plus protégé par le middleware, et plus aucune
 * connexion n'était possible. Chacune est verrouillée ici.
 */
test.describe("en-têtes de sécurité", () => {
  test("toute page publique porte les en-têtes attendus", async ({ request }) => {
    const reponse = await request.get("/");
    expect(reponse.status()).toBe(200);

    const csp = reponse.headers()["content-security-policy"];
    expect(csp, "CSP absente").toBeTruthy();

    // La CSP doit être **à nonce**. Une CSP qui se contente de `'unsafe-inline'`
    // pour les scripts n'apporte presque rien : c'est la régression à empêcher.
    expect(csp).toMatch(/script-src[^;]*'nonce-[a-f0-9]{16,}'/);
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("frame-ancestors 'none'");

    expect(reponse.headers()["x-frame-options"]).toBe("DENY");
    expect(reponse.headers()["x-content-type-options"]).toBe("nosniff");
    expect(reponse.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(reponse.headers()["permissions-policy"]).toContain("geolocation=()");
  });

  test("le nonce change à chaque requête", async ({ request }) => {
    const extraire = (entete: string) => entete.match(/'nonce-([a-f0-9]+)'/)?.[1];
    const premier = extraire((await request.get("/")).headers()["content-security-policy"] ?? "");
    const second = extraire((await request.get("/")).headers()["content-security-policy"] ?? "");

    expect(premier).toBeTruthy();
    // Un nonce constant serait équivalent à ne pas en avoir : un attaquant
    // pourrait le recopier dans le script qu'il injecte.
    expect(second).not.toBe(premier);
  });

  test("aucune violation CSP ni erreur console sur les pages publiques", async ({ page }) => {
    const problemes: string[] = [];
    page.on("console", (message) => {
      const texte = message.text();
      if (/Content Security Policy|Refused to (execute|load|apply)/i.test(texte)) {
        problemes.push(texte);
      }
    });
    page.on("pageerror", (erreur) => problemes.push("JS: " + erreur.message));

    /*
     * Toutes les pages publiques, et non plus cinq d'entre elles. L'habillage
     * du §10 a touché chacune : une police, une icône ou une image bloquée par
     * la CSP ne se voit pas en relecture, seulement ici.
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
      await page.goto(chemin, { waitUntil: "networkidle" });
    }

    expect(problemes).toEqual([]);
  });

  test("le middleware ne remplace pas la politique posée par une route", async ({ request }) => {
    /*
     * Défaut fermé ici, trouvé par le test du logo SVG : `applySecurityHeaders`
     * posait la CSP du site sans regarder si la réponse en portait déjà une.
     * La route qui sert un logo vectoriel voyait donc sa politique stricte
     * remplacée par celle des pages, qui autorise `script-src 'self'` et
     * `'unsafe-inline'` — de quoi laisser s'exécuter un script logé dans un SVG
     * ouvert en navigation directe.
     *
     * Les deux sens sont vérifiés : la page garde la politique du site, la
     * route garde la sienne.
     */
    const page = await request.get("/");
    expect(page.headers()["content-security-policy"]).toContain("default-src 'self'");
  });

  test("le nonce est bien appliqué aux scripts de Next", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const comptes = await page.evaluate(() => {
      const scripts = [...document.querySelectorAll("script")];
      return {
        total: scripts.length,
        avecNonce: scripts.filter((s) => s.nonce || s.getAttribute("nonce")).length,
      };
    });

    expect(comptes.total).toBeGreaterThan(0);
    // Un seul script sans nonce et la page cesse de fonctionner : c'est le
    // signal qu'une CSP a été durcie sans être vérifiée.
    expect(comptes.avecNonce).toBe(comptes.total);
  });
});

test.describe("garde du BackOffice", () => {
  const routesProtegees = [
    "/admin",
    "/admin/participants",
    "/admin/invitations",
    "/admin/notifications",
    "/admin/2fa/enroll",
  ];

  for (const route of routesProtegees) {
    test(`${route} redirige vers la connexion sans session`, async ({ page }) => {
      const reponse = await page.goto(route);

      // Ni 200 (page servie), ni 500 : la page d'enrôlement 2FA plantait en 500
      // parce qu'elle supposait une session que la garde ne fournissait plus.
      expect(page.url()).toContain("/connexion");
      expect(reponse?.status()).toBeLessThan(400);
    });
  }

  test("une session valide ouvre le BackOffice", async ({ page }) => {
    const { seConnecterAdmin } = await import("./helpers/comptes");
    await seConnecterAdmin(page);

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
  });
});
