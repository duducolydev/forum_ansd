/**
 * Couleur d'un niveau de partenariat, sur la page publique (§32).
 *
 * Dérivée du rang du niveau plutôt que saisie : le comité range ses échelons,
 * il n'a pas à choisir des couleurs, et un champ de couleur libre aurait fini
 * par produire des contrastes invérifiables. Les teintes sont celles du système
 * du site, déjà validées en clair comme en sombre.
 *
 * L'ordre suit la valeur perçue des échelons : l'or au premier, puis le bleu,
 * le vert, l'ambre. Au-delà, la liste recommence — cinq niveaux se distinguent,
 * quinze ne se distingueraient plus de toute façon.
 */
export interface TonNiveau {
  /** Pastille du niveau, coin inférieur droit de la carte. */
  pastille: string;
  /** Filet coloré en haut de carte, et halo au survol. */
  filet: string;
  /** Fond très pâle de la zone du logo. */
  fond: string;
}

const TONS: TonNiveau[] = [
  {
    pastille: "bg-gold-soft text-gold-text",
    filet: "from-ansd-or to-gold-text",
    fond: "from-gold-soft/45",
  },
  {
    pastille: "bg-blue-soft text-blue-text",
    filet: "from-ansd-bleu-vif to-blue-text",
    fond: "from-blue-soft/45",
  },
  {
    pastille: "bg-accent-soft text-accent-text",
    filet: "from-ansd-vert-vif to-accent-text",
    fond: "from-accent-soft/45",
  },
  {
    pastille: "bg-warn-soft text-warn-text",
    filet: "from-warn-text to-gold-text",
    fond: "from-warn-soft/45",
  },
];

export function tonDuNiveau(rang: number): TonNiveau {
  // Un rang négatif ou hors bornes ne doit jamais faire tomber la page sur
  // `undefined` : le modulo est calculé sur une valeur positive.
  const index = ((rang % TONS.length) + TONS.length) % TONS.length;
  return TONS[index]!;
}
