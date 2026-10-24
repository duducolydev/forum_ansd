/**
 * Mention imprimée sous l'en-tête du badge.
 *
 * - **Presse** (catégorie soumise à accréditation) : « ACCRÉDITATION PRESSE »,
 *   seulement une fois l'accréditation accordée, sur la bande bleu nuit
 *   d'origine (29 septembre 2026) — inchangée ;
 * - **Toute autre catégorie** dotée d'une mention en BackOffice (« COMITÉ
 *   D'ORGANISATION »…) : imprimée en bande pleine à la couleur de la catégorie,
 *   la distinction la plus visible au contrôle d'entrée (24 octobre 2026).
 *
 * Une catégorie presse qui porte sa propre mention l'imprime à la place de
 * « ACCRÉDITATION PRESSE », dans le même style et aux mêmes conditions.
 */
export interface MentionBadge {
  mention: string | null;
  /** Bande à la couleur de la catégorie ; sinon, bande bleu nuit. */
  mentionEnCouleur: boolean;
}

export function mentionDuBadge(
  categorie: { requiresAccreditation: boolean; badgeMention: string | null },
  accreditedAt: Date | null,
): MentionBadge {
  const propre = categorie.badgeMention?.trim() || null;
  if (categorie.requiresAccreditation) {
    return {
      mention: accreditedAt ? (propre ?? "ACCRÉDITATION PRESSE") : null,
      mentionEnCouleur: false,
    };
  }
  return { mention: propre, mentionEnCouleur: propre !== null };
}
