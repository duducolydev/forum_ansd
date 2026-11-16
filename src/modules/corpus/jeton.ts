import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Jeton de l'export du corpus (16 novembre 2026).
 *
 * ## Pourquoi facultatif
 *
 * Le contenu livré par `/api/v1/corpus` est déjà public page par page ;
 * l'exposer d'un bloc n'apprend rien à qui sait lire le site. Mais un export
 * complet est aussi une invitation à l'aspiration automatique, et il coûte une
 * douzaine de requêtes. `CORPUS_TOKEN`, s'il est défini, devient donc
 * obligatoire ; absent, la route reste ouverte — ce qui laisse la recette et le
 * développement fonctionner sans secret à installer.
 *
 * ## Pourquoi des empreintes
 *
 * `timingSafeEqual` exige deux tampons de **même longueur** et lève sinon : lui
 * passer directement le jeton fourni ferait donc dépendre le comportement de sa
 * longueur, c'est-à-dire divulguer celle du jeton attendu. Comparer les
 * empreintes SHA-256 règle les deux problèmes d'un coup — longueur fixe, et
 * aucune information sur l'endroit où les chaînes divergent.
 *
 * Module séparé de la route parce qu'un fichier `route.ts` ne peut pas exporter
 * autre chose que ses gestionnaires : c'est ici que la règle se teste.
 */

function empreinte(valeur: string): Buffer {
  return createHash("sha256").update(valeur, "utf8").digest();
}

/**
 * La requête a-t-elle le droit de lire le corpus ?
 *
 * `attendu` est le jeton configuré : vide ou absent, tout passe.
 */
export function jetonValide(fourni: string | null, attendu: string | undefined): boolean {
  const secret = attendu?.trim();
  if (!secret) return true;
  if (!fourni) return false;

  const propre = fourni.trim();
  if (!propre) return false;

  return timingSafeEqual(empreinte(secret), empreinte(propre));
}

/**
 * Jeton porté par la requête : `Authorization: Bearer <jeton>`, ou l'en-tête
 * `X-Corpus-Token` pour les clients qui réservent `Authorization` à autre chose.
 */
export function jetonDeLaRequete(entetes: Pick<Headers, "get">): string | null {
  const autorisation = entetes.get("authorization");
  if (autorisation && /^bearer\s/i.test(autorisation)) {
    return autorisation.replace(/^bearer\s+/i, "");
  }
  return entetes.get("x-corpus-token");
}
