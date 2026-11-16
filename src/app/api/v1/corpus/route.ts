import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { adresseClient } from "@/lib/adresse-client";
import { rateLimit } from "@/lib/rate-limit";
import { estLangue, LANGUES, type Langue } from "@/lib/langue";
import { jetonDeLaRequete, jetonValide } from "@/modules/corpus/jeton";
import { construireCorpus } from "@/modules/corpus/service";

/**
 * Corpus public du portail, pour l'assistant de recherche interne (16 novembre
 * 2026).
 *
 * ## Ce que répond cette route
 *
 * Tout le contenu **publié** du site, aplati en texte et accompagné de
 * l'adresse de la page qui le porte — de quoi construire un index et répondre
 * « voici la réponse, et voici la page ». Rien d'autre : la composition du
 * corpus est décrite dans `modules/corpus/types.ts`, et aucune table de
 * participants n'y est lue.
 *
 * ## Pourquoi un jeton facultatif
 *
 * Le contenu livré ici est déjà public page par page ; l'exposer d'un bloc n'y
 * ajoute rien pour qui sait lire le site. Mais un export complet est aussi une
 * invitation à l'aspiration automatique, et il coûte une douzaine de requêtes.
 * `CORPUS_TOKEN`, s'il est défini, devient donc obligatoire ; absent, la route
 * reste ouverte, ce qui laisse la recette fonctionner sans secret à installer.
 * La règle et sa comparaison à temps constant vivent dans `modules/corpus/jeton.ts`,
 * où elles se testent — un fichier `route.ts` ne peut rien exporter d'autre que
 * ses gestionnaires.
 *
 * ## Débit
 *
 * 6 appels par minute et par adresse. Une réindexation complète en demande un ;
 * six laissent la place à un rattrapage, et pas à un robot qui boucle.
 */
export const dynamic = "force-dynamic";

/**
 * Langues demandées : `?langue=fr&langue=en`, ou `?langue=fr,en`.
 *
 * Une langue inconnue est ignorée plutôt que refusée — l'index reste
 * utilisable — mais une demande qui n'en contient aucune de valide retombe sur
 * les trois, pour ne jamais répondre un corpus vide par faute de frappe.
 */
function languesDemandees(parametres: URLSearchParams): Langue[] {
  const brutes = parametres
    .getAll("langue")
    .flatMap((valeur) => valeur.split(","))
    .map((valeur) => valeur.trim().toLowerCase())
    .filter(estLangue);

  const uniques = [...new Set(brutes)];
  return uniques.length > 0 ? uniques : [...LANGUES];
}

export async function GET(request: Request): Promise<NextResponse> {
  const entetes = await headers();

  if (!jetonValide(jetonDeLaRequete(entetes), process.env.CORPUS_TOKEN)) {
    // 404 et non 401 : une route d'export dont l'existence n'est pas confirmée
    // à qui n'a pas le jeton.
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  const ip = adresseClient(entetes);
  const debit = await rateLimit(`corpus:${ip}`, 6, 60);
  if (!debit.allowed) {
    return NextResponse.json(
      { error: "Trop de requêtes." },
      {
        status: 429,
        headers: { "Retry-After": String(debit.retryAfterSeconds), "Cache-Control": "no-store" },
      },
    );
  }

  const parametres = new URL(request.url).searchParams;
  const depuisBrut = parametres.get("depuis");
  const depuis = depuisBrut ? new Date(depuisBrut) : undefined;
  if (depuis && Number.isNaN(depuis.getTime())) {
    return NextResponse.json(
      { error: "Paramètre `depuis` invalide : attendu une date ISO 8601." },
      { status: 400 },
    );
  }

  const corpus = await construireCorpus({ langues: languesDemandees(parametres), depuis });

  return NextResponse.json(corpus, {
    headers: {
      // Un index se reconstruit sur demande : pas de cache intermédiaire, et
      // surtout pas de version figée d'un programme qui vient de changer.
      "Cache-Control": "no-store",
    },
  });
}
