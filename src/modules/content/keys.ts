/** Registre des zones éditoriales (brief §5.11) — source unique pour l'admin et le seed. */
export const CONTENT_BLOCK_KEYS = [
  { key: "home.hero.title", label: "Accueil — Titre principal" },
  { key: "home.hero.lead", label: "Accueil — Texte d'introduction" },
  { key: "home.objectives.intro", label: "Accueil — Introduction des trois journées" },
  { key: "about.body", label: "À propos — Texte principal" },
  { key: "practical.venue", label: "Infos pratiques — Lieu" },
  { key: "practical.arrival", label: "Infos pratiques — Arrivée" },
  { key: "practical.accommodation", label: "Infos pratiques — Hébergement" },
  { key: "practical.visa", label: "Infos pratiques — Visas" },
  { key: "practical.transport", label: "Infos pratiques — Transports" },
  { key: "practical.contacts", label: "Infos pratiques — Contacts" },
  { key: "legal.privacy", label: "Mentions — Politique de confidentialité" },
  { key: "legal.terms", label: "Mentions — Mentions légales" },
] as const;

export type ContentBlockKey = (typeof CONTENT_BLOCK_KEYS)[number]["key"];
