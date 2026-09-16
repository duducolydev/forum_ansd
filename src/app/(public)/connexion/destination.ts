/**
 * Destination après connexion, tirée de `callbackUrl` (PLAN.md §16).
 *
 * Jusqu'ici ignorée : un agent qui ouvrait `/scan` passait par la connexion et
 * se retrouvait sur `/admin`, à devoir rechercher le scanner dans le menu.
 *
 * Le paramètre vient de l'adresse, donc de n'importe qui : un lien piégé
 * `?callbackUrl=https://site-tiers` ferait de la page de connexion du Forum un
 * tremplin vers un faux site. D'où trois règles :
 *
 * - une adresse absolue n'est acceptée que si elle vise **ce** site ;
 * - seul le **chemin** est conservé, jamais l'hôte — `/\site-tiers` ou
 *   `//site-tiers` ne peuvent donc pas ressortir ailleurs ;
 * - le chemin doit mener au BackOffice ou au scanner, les seules destinations
 *   de ce formulaire.
 */

const BASE_FICTIVE = "http://destination.invalid";

function estSousChemin(chemin: string, racine: string): boolean {
  return chemin === racine || chemin.startsWith(`${racine}/`);
}

export function destinationSure(brut: string, hoteCourant: string | null): string | null {
  const valeur = brut.trim();
  if (!valeur) return null;

  const absolue = /^[a-z][a-z0-9+.-]*:/i.test(valeur) || valeur.startsWith("//");
  if (!absolue && !valeur.startsWith("/")) return null;

  let url: URL;
  try {
    url = new URL(valeur, BASE_FICTIVE);
  } catch {
    return null;
  }

  if (absolue && (!hoteCourant || url.host !== hoteCourant)) return null;
  // Relative en apparence, mais résolue ailleurs (`/\site-tiers`) : refusée.
  if (!absolue && url.host !== new URL(BASE_FICTIVE).host) return null;

  if (!estSousChemin(url.pathname, "/admin") && !estSousChemin(url.pathname, "/scan")) {
    return null;
  }

  return `${url.pathname}${url.search}`;
}
