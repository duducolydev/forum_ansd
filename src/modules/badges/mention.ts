/**
 * Mention imprimée dans le bandeau coloré du bas du badge, à la place du
 * libellé de la catégorie (maquette du 26 octobre 2026).
 *
 * - **Presse** (catégorie soumise à accréditation) : « ACCRÉDITATION PRESSE »,
 *   seulement une fois l'accréditation accordée (29 septembre 2026) ;
 * - **Toute autre catégorie** dotée d'une mention en BackOffice (« COMITÉ
 *   D'ORGANISATION »…) : toujours (24 octobre 2026).
 *
 * Une catégorie presse qui porte sa propre mention l'imprime à la place de
 * « ACCRÉDITATION PRESSE », aux mêmes conditions. Sans mention, le bandeau porte
 * le libellé de la catégorie.
 */
export interface MentionBadge {
  mention: string | null;
}

export function mentionDuBadge(
  categorie: { requiresAccreditation: boolean; badgeMention: string | null },
  accreditedAt: Date | null,
): MentionBadge {
  const propre = categorie.badgeMention?.trim() || null;
  if (categorie.requiresAccreditation) {
    return { mention: accreditedAt ? (propre ?? "ACCRÉDITATION PRESSE") : null };
  }
  return { mention: propre };
}
