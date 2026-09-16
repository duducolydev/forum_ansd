/**
 * Adresses des fichiers déposés.
 *
 * Module **sans aucune dépendance serveur**, et c'est sa raison d'être : ces
 * fonctions servent aussi bien au rendu public qu'aux formulaires du
 * BackOffice, qui sont des composants clients. Les laisser dans
 * `image-deposee.ts` — lequel importe la détection de type, donc Prisma par
 * transitivité — entraînait Prisma dans le paquet du navigateur et faisait
 * échouer la construction. Même piège que celui documenté dans
 * `modules/sponsors/constantes.ts`.
 */
/**
 * Empreinte d'un fichier déposé, à mettre dans l'URL qui le sert.
 *
 * ## Le défaut que cela ferme
 *
 * Les fichiers sont enregistrés sous un nom à suffixe aléatoire, précisément
 * pour qu'un remplacement produise une nouvelle adresse. Mais les routes qui
 * les servent adressent par **identifiant d'entité** :
 * `/api/v1/sections/<id>/image`. Cette URL, elle, ne change jamais — et elle
 * répond `Cache-Control: public, max-age=600`.
 *
 * Conséquence, constatée en usage réel : après avoir remplacé une illustration,
 * l'agent continue de voir l'ancienne pendant dix minutes, en BackOffice comme
 * sur le site. Le fichier est bien enregistré, le serveur sert bien le nouveau,
 * mais le navigateur ne le redemande pas. L'intention écrite dans le service —
 * « un remplacement change l'URL » — était démentie par la route.
 *
 * Ajouter l'empreinte au lien rétablit ce qui était voulu : chemin différent,
 * URL différente, cache contourné. Sans empreinte, la fonction renvoie une
 * chaîne vide et l'URL reste inchangée.
 */
export function empreinteDeChemin(chemin: string): string {
  const nom = chemin.split("/").pop() ?? "";
  const correspondance = /-([0-9a-f]{6,})\.[^.]+$/i.exec(nom);
  return correspondance?.[1] ?? "";
}

/** URL de service d'un fichier déposé, versionnée par son empreinte. */
export function urlVersionnee(base: string, chemin: string): string {
  const empreinte = empreinteDeChemin(chemin);
  return empreinte ? `${base}?v=${empreinte}` : base;
}
