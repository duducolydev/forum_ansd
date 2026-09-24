/**
 * Structure de la navigation publique, partagée par l'en-tête et le menu mobile.
 *
 * Les sept entrées à plat du gabarit de référence (1502 px de contenu pour un
 * conteneur de 1200) sont regroupées par thématique : le menu tient désormais
 * largement, et les pages `/actualites` et `/contributions` — qui existaient
 * sans figurer dans aucun menu — deviennent atteignables.
 *
 * « À propos » n'y figure plus : son contenu est devenu une section de la page
 * d'accueil (§12), atteignable par l'ancre `/#a-propos`.
 */
export interface NavLeaf {
  href: string;
  /** Clé du namespace `nav` des fichiers de traduction. */
  key: string;
}

export interface NavGroup {
  key: string;
  children: NavLeaf[];
}

export type NavEntry = NavLeaf | NavGroup;

export function isGroup(entry: NavEntry): entry is NavGroup {
  return "children" in entry;
}

export const NAV_ENTRIES: readonly NavEntry[] = [
  { href: "/", key: "home" },
  {
    key: "theForum",
    children: [
      { href: "/programme", key: "program" },
      { href: "/intervenants", key: "speakers" },
      { href: "/contributions", key: "contributions" },
    ],
  },
  {
    key: "infoServices",
    children: [
      { href: "/infos-pratiques", key: "practicalInfo" },
      { href: "/actualites", key: "news" },
      { href: "/newsletters", key: "newsletters" },
      { href: "/verifier", key: "verifyBadge" },
    ],
  },
  { href: "/sponsors", key: "sponsors" },
  { href: "/admin", key: "admin" },
] as const;
