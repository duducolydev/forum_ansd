import { expect, test } from "@playwright/test";
import { prisma } from "../src/lib/db";
import { seConnecterAdmin } from "./helpers/comptes";

/**
 * Rappels planifiés (brief §14, PLAN.md 4.10).
 *
 * L'édition de démonstration se tient en novembre 2026, donc dans le passé du
 * calendrier de cette machine : les deux échéances sont dépassées, et c'est
 * précisément le cas que l'écran doit savoir annoncer plutôt que d'envoyer un
 * « le Forum commence dans sept jours » après coup.
 */
test("annonce les échéances et refuse d'envoyer celles qui sont passées", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto("/admin/notifications");

  const bloc = page.locator("section").filter({ hasText: "Rappels avant le Forum" });
  await expect(bloc).toBeVisible();
  await expect(bloc).toContainText("Une semaine avant");
  await expect(bloc).toContainText("La veille");

  const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
  const passee = edition.startDate.getTime() < Date.now();

  if (passee) {
    await expect(bloc).toContainText("échéance passée");
    // Le bouton est désactivé : rien à programmer, et surtout rien à envoyer
    // en retard.
    await expect(bloc.getByRole("button", { name: /Programmer les rappels/ })).toBeDisabled();
  } else {
    await bloc.getByRole("button", { name: /Programmer les rappels/ }).click();
    await expect(bloc.getByText(/rappel\(s\) programmé\(s\)/)).toBeVisible();
  }
});

test("les modèles de rappel existent et sont bilingues", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto("/admin/notifications");

  // Sans modèle, la programmation échouerait à l'envoi, longtemps après le clic.
  for (const cle of ["reminder_j7", "reminder_j1"]) {
    const modele = await prisma.notificationTemplate.findFirstOrThrow({
      where: { key: cle, channel: "EMAIL" },
    });
    // Les deux sujets sont nullables en base (un modèle peut n'exister que
    // dans une langue) : ces deux-ci doivent porter les deux.
    expect(modele.subjectFr ?? "").not.toBe("");
    expect(modele.subjectEn ?? "").not.toBe("");
    expect(modele.bodyFr).toContain("{{prenom}}");
  }
});

test("la page publique reste traduite malgré la mise en cache des contenus", async ({
  request,
}) => {
  // Le cache de 60 s porte sur les données, pas sur la page : la langue du
  // visiteur doit continuer de décider du rendu (arbitrage C13).
  const fr = await request.get("/", { headers: { Cookie: "NEXT_LOCALE=fr" } });
  const en = await request.get("/", { headers: { Cookie: "NEXT_LOCALE=en" } });

  expect(await fr.text()).toContain('lang="fr"');
  expect(await en.text()).toContain('lang="en"');
});
