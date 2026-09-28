/**
 * Couleur d'un niveau de partenariat, sur le site public (§32).
 *
 * Dérivée du niveau lui-même plutôt que saisie : le comité range ses échelons,
 * il n'a pas à choisir des couleurs, et un champ de couleur libre aurait fini
 * par produire des contrastes invérifiables. Chaque teinte est un jeton de
 * `globals.css`, mesuré en clair comme en sombre par `palette.test.ts`.
 *
 * La couleur suit ce que le niveau **veut dire** — l'or pour Gold, l'argent
 * pour Silver, le bleu pour les médias, le jaune pour les partenaires
 * techniques (demande du commanditaire, 28 septembre 2026). Elle était
 * auparavant tirée du rang (`sortOrder % 4`) ; or les rangs vont de 10 en 10,
 * et Sponsor principal, Silver, Institutionnel et Média tombaient tous sur le
 * même vert.
 */
export interface TonNiveau {
  /** Pastille du niveau, coin inférieur droit de la carte. */
  pastille: string;
  /** Filet coloré en haut de carte. */
  filet: string;
  /** Fond très pâle de la zone du logo. */
  fond: string;
}

export type CleTon =
  "principal" | "or" | "argent" | "bronze" | "institutionnel" | "technique" | "media";

export const TONS: Record<CleTon, TonNiveau> = {
  principal: {
    pastille: "bg-accent-soft text-accent-text",
    filet: "from-ansd-bleu-vif to-ansd-vert-vif",
    fond: "from-accent-soft/45",
  },
  /*
   * Or et argent en dégradé « métal » : un aplat de jaune ou de gris ne se lit
   * pas comme un métal. Le texte tient 4,5:1 sur les **deux** arrêts du
   * dégradé, pas seulement sur leur moyenne.
   */
  or: {
    pastille:
      "bg-gradient-to-br from-or-soft to-or-soft-2 text-or-text ring-1 ring-inset ring-or-vif/45",
    filet: "from-or-vif via-or-reflet to-or-vif",
    fond: "from-or-soft/55",
  },
  argent: {
    pastille:
      "bg-gradient-to-br from-argent-soft to-argent-soft-2 text-argent-text ring-1 ring-inset ring-argent-vif/55",
    filet: "from-argent-vif via-argent-reflet to-argent-vif",
    fond: "from-argent-soft-2/40",
  },
  bronze: {
    pastille: "bg-bronze-soft text-bronze-text",
    filet: "from-bronze-vif to-bronze-text",
    fond: "from-bronze-soft/45",
  },
  institutionnel: {
    pastille: "bg-accent-soft text-accent-text",
    filet: "from-ansd-vert-vif to-accent-text",
    fond: "from-accent-soft/45",
  },
  technique: {
    pastille: "bg-jaune-soft text-jaune-text",
    filet: "from-jaune-vif to-or-vif",
    fond: "from-jaune-soft/50",
  },
  media: {
    pastille: "bg-blue-soft text-blue-text",
    filet: "from-ansd-bleu-vif to-blue-text",
    fond: "from-blue-soft/45",
  },
};

/**
 * Mots qui désignent chaque ton, cherchés dans le code **puis** dans le libellé.
 *
 * Le code seul ne suffit pas : le comité crée ses niveaux en BackOffice, et un
 * « PARTENAIRE_MEDIA » ou un « Sponsor Or » doit prendre sa couleur sans que
 * personne ait à la déclarer. L'ordre compte — « Partenaire technique » ne doit
 * pas être lu comme institutionnel parce qu'il contient « partenaire ».
 */
const MOTS: [CleTon, RegExp][] = [
  ["principal", /\b(PRINCIPAL|PLATINE|PLATINUM|DIAMANT|DIAMOND|TITRE)\b/],
  ["or", /\b(GOLD|OR)\b/],
  ["argent", /\b(SILVER|ARGENT)\b/],
  ["bronze", /\bBRONZE\b/],
  ["media", /\b(MEDIAS?|PRESSE|PRESS)\b/],
  ["technique", /\b(TECHNIQUES?|TECHNICAL|TECH)\b/],
  ["institutionnel", /\b(INSTITUTIONNELS?|INSTITUTIONAL)\b/],
];

/** Majuscules sans accents, mots séparés : « Partenaire média » → « PARTENAIRE MEDIA ». */
function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ");
}

export function cleDuNiveau(niveau: { code: string; name: string }): CleTon {
  for (const source of [niveau.code, niveau.name]) {
    const texte = normaliser(source);
    for (const [cle, motif] of MOTS) {
      if (motif.test(texte)) return cle;
    }
  }
  // Un niveau inconnu prend le vert du site : neutre, et jamais un faux métal.
  return "institutionnel";
}

export function tonDuNiveau(niveau: { code: string; name: string }): TonNiveau {
  return TONS[cleDuNiveau(niveau)];
}
