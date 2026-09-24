import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { lireTexteRiche, type BlocRiche, type EnLigneRiche } from "@/lib/texte-riche";
import { fileStorage } from "@/lib/storage";
import { detectImageType } from "@/modules/participants/photo";
import { lireImages } from "./schema";

/**
 * Gabarit PDF d'une newsletter (§34).
 *
 * Le HTML est **autonome** : CSS en ligne, images en `data:` URI, aucune
 * ressource distante. C'est la même règle que pour le badge — le rendu
 * Puppeteer n'attend alors aucun réseau, et le fichier se produit à la demande
 * sans dépendre de ce que le serveur sait joindre.
 *
 * Écrit à la main plutôt que capturé depuis la page publique : la page porte
 * une barre de navigation, un pied de page et un appel à l'action qui n'ont
 * rien à faire dans un document qu'on imprime ou qu'on archive.
 */

export interface DonneesPdf {
  titre: string;
  chapo: string;
  dates: string;
  edition: string;
  corps: string;
  images: unknown;
  logoDataUrl: string | null;
}

const BLEU_NUIT = "#082c4e";
const BLEU_VIF = "#2f7fd1";
const VERT_VIF = "#3dbb6e";

function echapper(valeur: string): string {
  return valeur
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * Logo du Forum, lu une fois et gardé en mémoire.
 *
 * Même fichier réduit que pour le badge : 82 Ko au lieu de 1,48 Mo. Un PDF de
 * newsletter n'a pas plus besoin d'un logo en 4 460 pixels qu'un badge.
 */
let lectureLogo: Promise<string> | null = null;

export async function logoDataUrl(): Promise<string | null> {
  lectureLogo ??= readFile(join(process.cwd(), "public", "images", "logo_forum_badge.png")).then(
    (octets) => `data:image/png;base64,${octets.toString("base64")}`,
  );
  try {
    return await lectureLogo;
  } catch {
    lectureLogo = null;
    return null;
  }
}

/** Images du corps, converties en `data:` URI une seule fois par document. */
async function chargerImages(brut: unknown): Promise<(string | null)[]> {
  const chemins = lireImages(brut);
  return Promise.all(
    chemins.map(async ({ path }) => {
      try {
        const octets = await fileStorage.get(path);
        const detecte = detectImageType(octets);
        if (!detecte) return null;
        return `data:${detecte.type};base64,${octets.toString("base64")}`;
      } catch {
        // Une image manquante ne doit pas faire échouer le document entier :
        // le reste du texte vaut d'être lu.
        return null;
      }
    }),
  );
}

function enLigneVersHtml(noeuds: EnLigneRiche[] | undefined): string {
  return (noeuds ?? [])
    .map((noeud) => {
      if (noeud.type === "hardBreak") return "<br />";
      let html = echapper(noeud.text);
      for (const marque of noeud.marks ?? []) {
        if (marque.type === "bold") html = `<strong>${html}</strong>`;
        else if (marque.type === "italic") html = `<em>${html}</em>`;
        else if (marque.type === "underline") html = `<u>${html}</u>`;
        else if (marque.type === "link") {
          // Le lien reste cliquable dans le PDF, et son adresse est écrite en
          // toutes lettres : un document imprimé ne se clique pas.
          html = `<a href="${echapper(marque.attrs.href)}">${html}</a>`;
        }
      }
      return html;
    })
    .join("");
}

function blocsVersHtml(blocs: BlocRiche[], images: (string | null)[]): string {
  return blocs
    .map((bloc) => {
      if (bloc.type === "paragraph") return `<p>${enLigneVersHtml(bloc.content)}</p>`;

      if (bloc.type === "image") {
        const src = images[bloc.attrs.cle];
        if (!src) return "";
        const marge =
          bloc.attrs.alignement === "gauche"
            ? "margin-right:auto"
            : bloc.attrs.alignement === "droite"
              ? "margin-left:auto"
              : "margin-left:auto;margin-right:auto";
        return `<img src="${src}" alt="${echapper(bloc.attrs.alt)}" style="display:block;height:auto;border-radius:6px;width:${bloc.attrs.largeur}%;${marge}" />`;
      }

      const elements = bloc.content
        .map((element) => `<li>${blocsVersHtml(element.content, images)}</li>`)
        .join("");
      return bloc.type === "orderedList" ? `<ol>${elements}</ol>` : `<ul>${elements}</ul>`;
    })
    .join("");
}

export async function renderNewsletterPdfHtml(donnees: DonneesPdf): Promise<string> {
  const images = await chargerImages(donnees.images);
  const corps = blocsVersHtml(lireTexteRiche(donnees.corps, { images: true }).content, images);

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4; margin: 18mm 16mm 20mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    color: #1f2d3d; font-size: 10.5pt; line-height: 1.55;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  header { border-bottom: 2px solid ${BLEU_VIF}; padding-bottom: 6mm; margin-bottom: 8mm; }
  header img { height: 14mm; width: auto; display: block; margin-bottom: 4mm; }
  .edition { font-size: 8pt; color: #4e6a88; letter-spacing: 0.04em; text-transform: uppercase; }
  h1 { font-size: 19pt; line-height: 1.2; color: ${BLEU_NUIT}; margin: 2mm 0 3mm; }
  .chapo { font-size: 11.5pt; color: #33506f; font-weight: 500; }
  .dates { font-size: 8.5pt; color: #7a8fa6; margin-top: 2mm; }
  /* Le rythme est porté par le conteneur : un paragraphe n'a pas à connaître
     ses voisins, et les images gardent la même respiration que le texte. */
  main > * + * { margin-top: 4mm; }
  ul, ol { padding-left: 6mm; }
  li + li { margin-top: 1.5mm; }
  a { color: ${BLEU_VIF}; }
  footer {
    margin-top: 12mm; padding-top: 4mm; border-top: 1px solid #dbe7f3;
    font-size: 8pt; color: #7a8fa6;
  }
  footer .filet { height: 1.5mm; background: linear-gradient(90deg, ${BLEU_VIF}, ${VERT_VIF}); border-radius: 2px; margin-bottom: 3mm; }
</style>
</head>
<body>
  <header>
    ${donnees.logoDataUrl ? `<img src="${donnees.logoDataUrl}" alt="" />` : ""}
    <div class="edition">${echapper(donnees.edition)}</div>
    <h1>${echapper(donnees.titre)}</h1>
    <p class="chapo">${echapper(donnees.chapo)}</p>
    <p class="dates">${echapper(donnees.dates)}</p>
  </header>
  <main>${corps}</main>
  <footer>
    <div class="filet"></div>
    Agence nationale de la Statistique et de la Démographie — ${echapper(donnees.edition)}
  </footer>
</body>
</html>`;
}
