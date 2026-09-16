import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Valide la boîte de confirmation du BackOffice.
 *
 * Les confirmations passaient par `window.confirm`, que Playwright interceptait
 * avec `page.once("dialog", …)`. Elles passent désormais par SweetAlert2, qui
 * est du DOM ordinaire : on clique le bouton, et on attend la disparition de la
 * boîte avant de poursuivre — sans cette attente, l'assertion suivante partait
 * pendant l'animation de fermeture et trouvait encore l'ancien état.
 */
export async function confirmerBoite(page: Page): Promise<void> {
  const boite = page.locator(".swal2-popup");
  await expect(boite).toBeVisible();
  await page.locator("button.swal2-confirm").click();
  await expect(boite).toHaveCount(0);
}

/** Clique un bouton puis valide la confirmation qu'il déclenche. */
export async function cliquerPuisConfirmer(
  page: Page,
  bouton: Locator | { nom: string; dans?: Locator },
): Promise<void> {
  const cible =
    "click" in bouton ? bouton : (bouton.dans ?? page).getByRole("button", { name: bouton.nom });
  await cible.click();
  await confirmerBoite(page);
}
