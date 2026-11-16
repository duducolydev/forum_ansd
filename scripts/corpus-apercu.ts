import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { prisma } from "../src/lib/db";
import { construireCorpus } from "../src/modules/corpus/service";
import type { DocumentCorpus } from "../src/modules/corpus/types";

/**
 * Aperçu du corpus public (16 novembre 2026).
 *
 *     pnpm corpus:apercu                 # résumé à l'écran, langue française
 *     pnpm corpus:apercu --langue en,pt  # autres langues
 *     pnpm corpus:apercu --json corpus.json
 *
 * ## À quoi ça sert
 *
 * L'export de `/api/v1/corpus` est fait pour être lu par une machine ; ce qui
 * s'y voit mal, c'est ce qu'il **ne** contient pas. Un contenu dont le texte
 * est vide, une rubrique jamais remplie, une séance sans description : l'index
 * les prend quand même, et l'assistant répondra par un titre sans réponse.
 *
 * Ce script compte, par type, et **nomme les documents sans texte**. C'est la
 * vérification à faire avant d'annoncer l'export à l'équipe de l'assistant, et
 * après chaque campagne de saisie du comité : la liste vide est le but.
 *
 * Lecture seule : rien n'est écrit en base, le script peut tourner sur le
 * serveur.
 */

function argument(nom: string): string | undefined {
  const index = process.argv.indexOf(`--${nom}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const LANGUES_VALIDES = ["fr", "en", "pt"] as const;
type LangueValide = (typeof LANGUES_VALIDES)[number];

function languesDemandees(): LangueValide[] {
  const brut = argument("langue") ?? "fr";
  const retenues = brut
    .split(",")
    .map((valeur) => valeur.trim().toLowerCase())
    .filter((valeur): valeur is LangueValide =>
      (LANGUES_VALIDES as readonly string[]).includes(valeur),
    );
  return retenues.length > 0 ? retenues : ["fr"];
}

/** Un document sans corps ni résumé ne répond à rien : il n'a qu'un titre. */
function sansReponse(document: DocumentCorpus): boolean {
  return document.texte.trim().length === 0 && document.resume.trim().length === 0;
}

async function principal(): Promise<void> {
  const langues = languesDemandees();
  const corpus = await construireCorpus({ langues });

  console.log(`Édition ${corpus.edition.code} — ${corpus.edition.titre}`);
  console.log(`Base publique : ${corpus.base}`);
  console.log(`Langues : ${corpus.langues.join(", ")}`);
  console.log(`Documents : ${corpus.nombre}\n`);

  const parType = new Map<string, DocumentCorpus[]>();
  for (const document of corpus.documents) {
    const liste = parType.get(document.type) ?? [];
    liste.push(document);
    parType.set(document.type, liste);
  }

  const types = [...parType.entries()].sort((a, b) => b[1].length - a[1].length);
  const largeur = Math.max(...types.map(([type]) => type.length));

  console.log("Par type :");
  for (const [type, documents] of types) {
    const signes = documents.reduce((somme, document) => somme + document.texte.length, 0);
    const creux = documents.filter(sansReponse).length;
    console.log(
      `  ${type.padEnd(largeur)}  ${String(documents.length).padStart(4)} documents` +
        `  ${String(Math.round(signes / 1000)).padStart(5)} kilo-signes` +
        (creux > 0 ? `  — dont ${creux} sans texte` : ""),
    );
  }

  const creux = corpus.documents.filter(sansReponse);
  if (creux.length === 0) {
    console.log("\nAucun document sans texte : tout ce qui est indexé peut répondre.");
  } else {
    console.log(`\n${creux.length} document(s) sans texte — un titre, et rien à répondre :`);
    for (const document of creux) {
      console.log(`  [${document.langue}] ${document.url}  ${document.titre}`);
    }
    console.log(
      "\nÀ remplir en BackOffice, ou à dépublier : indexés tels quels, ils feront " +
        "remonter une page vide en réponse à une vraie question.",
    );
  }

  const fichier = argument("json");
  if (fichier) {
    await writeFile(fichier, JSON.stringify(corpus, null, 2), "utf8");
    console.log(`\nCorpus complet écrit dans ${fichier}`);
  }
}

principal()
  .catch((erreur: unknown) => {
    console.error(erreur);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
