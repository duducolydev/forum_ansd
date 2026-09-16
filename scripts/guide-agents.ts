import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { closeBrowser, renderHtmlToPdf } from "../src/lib/pdf";

/**
 * Édite le guide de l'agent d'accueil en PDF (brief §14).
 *
 * Le PDF est **fabriqué à la demande** et non versionné : le fichier distribué
 * doit être celui du texte courant, et un PDF committé aurait vieilli au premier
 * changement de procédure sans que personne s'en aperçoive.
 *
 *     pnpm guide:agents [chemin/de/sortie.pdf]
 */
async function main(): Promise<void> {
  const source = join(process.cwd(), "docs", "guide-agents-accueil.html");
  const sortie = process.argv[2] ?? join(process.cwd(), "guide-agents-accueil.pdf");

  const html = await readFile(source, "utf8");
  const pdf = await renderHtmlToPdf(html, { format: "A4" });
  await writeFile(sortie, pdf);
  await closeBrowser();

  console.log(`Guide édité : ${sortie} (${Math.round(pdf.length / 1024)} Ko)`);
}

void main().catch((erreur: unknown) => {
  console.error(erreur);
  process.exit(1);
});
