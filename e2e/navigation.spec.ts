import { expect, test } from "@playwright/test";
import { prisma } from "../src/lib/db";
import { seConnecterAdmin } from "./helpers/comptes";

/**
 * Menu du BackOffice : repli, rubriques dépliables, menu utilisateur (§9).
 *
 * Ce qui est vérifié n'est pas l'apparence mais le comportement qui a un coût
 * s'il casse : l'état persiste entre deux pages, la rubrique de la page
 * courante reste ouverte même si elle a été repliée, et la déconnexion demande
 * confirmation avant de fermer la session.
 */

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("replie le menu et retient l'état d'une page à l'autre", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto("/admin/participants");

  const menu = page.locator("aside");
  await expect(menu).toHaveAttribute("data-replie", "false");
  await expect(menu.getByRole("link", { name: "Participants" })).toBeVisible();

  await page.getByRole("button", { name: "Replier le menu" }).click();
  await expect(menu).toHaveAttribute("data-replie", "true");

  // Replié, l'entrée reste atteignable : le libellé passe en nom accessible,
  // il ne disparaît pas.
  await expect(menu.getByRole("link", { name: "Participants" })).toBeVisible();

  // L'état est en cookie et lu par le serveur : il survit à une navigation
  // complète, pas seulement à un rendu client.
  await page.goto("/admin/sessions");
  await expect(page.locator("aside")).toHaveAttribute("data-replie", "true");

  await page.getByRole("button", { name: "Déplier le menu" }).click();
  await expect(page.locator("aside")).toHaveAttribute("data-replie", "false");
});

test("replie une rubrique, sauf celle de la page ouverte", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto("/admin/participants");

  const menu = page.locator("aside");
  const rubrique = menu.getByRole("button", { name: /Participants/ });

  await expect(rubrique).toHaveAttribute("aria-expanded", "true");
  await rubrique.click();

  /*
   * La rubrique contient la page courante : elle doit rester dépliée malgré le
   * clic. Se retrouver sur un écran dont l'entrée de menu a disparu fait perdre
   * le fil de l'endroit où l'on se trouve.
   */
  await expect(rubrique).toHaveAttribute("aria-expanded", "true");
  await expect(menu.getByRole("link", { name: "Invitations" })).toBeVisible();

  // Sur une autre page, le repli enregistré s'applique.
  await page.goto("/admin/sessions");
  await expect(page.locator("aside").getByRole("link", { name: "Invitations" })).toHaveCount(0);

  await page
    .locator("aside")
    .getByRole("button", { name: /Participants/ })
    .click();
  await expect(page.locator("aside").getByRole("link", { name: "Invitations" })).toBeVisible();
});

test("la déconnexion passe par la pastille et demande confirmation", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto("/admin");

  // Le bouton n'est pas visible tant que la pastille n'est pas ouverte.
  await expect(page.getByRole("menuitem", { name: "Se déconnecter" })).toHaveCount(0);

  await page.getByRole("button", { name: /Administrateur E2E/ }).click();
  const deconnexion = page.getByRole("menuitem", { name: "Se déconnecter" });
  await expect(deconnexion).toBeVisible();

  await deconnexion.click();
  await expect(page.locator(".swal2-popup")).toBeVisible();

  // Annuler laisse la session ouverte : c'est tout l'intérêt de la confirmation.
  await page.locator("button.swal2-cancel").click();
  await expect(page.locator(".swal2-popup")).toHaveCount(0);
  await expect(page).toHaveURL(/\/admin$/);

  // Confirmer déconnecte réellement.
  await page.getByRole("button", { name: /Administrateur E2E/ }).click();
  await page.getByRole("menuitem", { name: "Se déconnecter" }).click();
  await page.locator("button.swal2-confirm").click();
  await page.waitForURL(/\/connexion/);
});

test("les actions en icône seule gardent un nom accessible", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto("/admin/sessions");

  /*
   * Les quatre actions de ligne sont réduites à leur icône. Elles doivent
   * rester atteignables par leur nom : `title` seul ne nomme pas fiablement un
   * élément — c'est `aria-label` qui porte le nom, et c'est lui que cette
   * recherche par rôle interroge.
   */
  const ligne = page.getByRole("row").filter({ hasText: "Cérémonie d'ouverture" }).first();
  for (const nom of ["Inscriptions", "Dépublier", "Dupliquer", "Supprimer"]) {
    await expect(
      ligne.getByRole("link", { name: nom }).or(ligne.getByRole("button", { name: nom })),
    ).toHaveCount(1);
  }

  /*
   * Et le bouton lui-même ne porte plus de texte visible : c'est l'objet du
   * changement. On interroge le contenu du bouton plutôt que la ligne entière —
   * `getByText` retient aussi l'attribut `title`, qui est justement ce qu'on
   * vient d'y mettre.
   */
  await expect(ligne.getByRole("button", { name: "Dupliquer" })).toHaveText("");
});

test("les indicateurs du tableau de bord portent une icône et gardent leur libellé", async ({
  page,
}) => {
  await seConnecterAdmin(page);
  await page.goto("/admin");

  const tuiles = page.locator(".apparait");
  expect(await tuiles.count()).toBeGreaterThanOrEqual(8);

  // Les icônes sont décoratives : le libellé reste le seul porteur de sens, et
  // c'est lui qui doit rester lisible. La recherche est limitée aux tuiles :
  // « Inscrits » apparaît aussi dans les légendes des graphiques.
  for (const libelle of ["Inscrits", "Confirmés", "Taux de confirmation", "Badges valides"]) {
    await expect(tuiles.getByText(libelle, { exact: true }).first()).toBeVisible();
  }
});
