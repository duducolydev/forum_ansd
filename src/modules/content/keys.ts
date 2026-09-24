/**
 * Registre des zones éditoriales (brief §5.11) — source unique pour l'admin et
 * le seed.
 *
 * Chaque clé dit **comment elle s'écrit** : `riche` ouvre l'éditeur mis en
 * forme (gras, listes, liens), `max` plafonne le texte **visible**, balisage
 * exclu. Un titre reste du texte simple : il est rendu dans un `<h1>`, où une
 * liste à puces n'aurait aucun sens.
 */
export interface ZoneEditoriale {
  key: string;
  label: string;
  riche: boolean;
  max: number;
}

export const CONTENT_BLOCK_KEYS: readonly ZoneEditoriale[] = [
  { key: "home.hero.title", label: "Accueil — Titre principal", riche: false, max: 120 },
  { key: "home.hero.lead", label: "Accueil — Texte d'introduction", riche: true, max: 400 },
  {
    key: "home.objectives.intro",
    label: "Accueil — Introduction des trois journées",
    riche: true,
    max: 600,
  },
  { key: "about.body", label: "À propos — Texte principal", riche: true, max: 3000 },
  { key: "practical.venue", label: "Infos pratiques — Lieu", riche: true, max: 400 },
  { key: "practical.arrival", label: "Infos pratiques — Arrivée", riche: true, max: 400 },
  {
    key: "practical.accommodation",
    label: "Infos pratiques — Hébergement",
    riche: true,
    max: 400,
  },
  { key: "practical.visa", label: "Infos pratiques — Visas", riche: true, max: 400 },
  { key: "practical.transport", label: "Infos pratiques — Transports", riche: true, max: 400 },
  { key: "practical.contacts", label: "Infos pratiques — Contacts", riche: true, max: 400 },
  /*
   * Pages de détail des « Infos pratiques » (§29). Les encarts de la page
   * d'accueil de la rubrique tiennent en 400 signes ; ces textes-là sont ceux
   * qu'on lit une fois, en préparant son voyage, et n'ont pas à être
   * comprimés.
   *
   * Hébergement et Contacts n'en ont pas : leur détail est une liste
   * structurée d'hôtels et de contacts, tenue hors de l'éditorial.
   */
  { key: "practical.venue.detail", label: "Détail — Lieu", riche: true, max: 6000 },
  { key: "practical.arrival.detail", label: "Détail — Arrivée", riche: true, max: 6000 },
  { key: "practical.visa.detail", label: "Détail — Visas", riche: true, max: 6000 },
  { key: "practical.transport.detail", label: "Détail — Transports", riche: true, max: 6000 },
  {
    key: "legal.privacy",
    label: "Mentions — Politique de confidentialité",
    riche: true,
    max: 5000,
  },
  { key: "legal.terms", label: "Mentions — Mentions légales", riche: true, max: 5000 },
] as const;

export type ContentBlockKey = (typeof CONTENT_BLOCK_KEYS)[number]["key"];

/** Déclaration d'une zone éditoriale, ou `undefined` si la clé est inconnue. */
export function zoneEditoriale(key: string): ZoneEditoriale | undefined {
  return CONTENT_BLOCK_KEYS.find((zone) => zone.key === key);
}
