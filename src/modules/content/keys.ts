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
