/**
 * Ordre des intervenants d'une session (5 novembre 2026) : les modérateurs en
 * tête, puis les panélistes, puis les autres rôles.
 *
 * Seul l'ordre de rattachement (`sortOrder`) comptait : un modérateur ajouté
 * après les panélistes apparaissait en fin de liste. Le rôle passe désormais
 * devant ; à rôle égal, l'ordre de rattachement est conservé — le tri est
 * stable, et la requête livre déjà les intervenants dans cet ordre.
 *
 * Écrit ici plutôt que confié à la base : trier une énumération MySQL suit
 * l'ordre de déclaration de ses valeurs, une règle trop discrète pour porter
 * une exigence du comité.
 */
const RANG_ROLE: Record<string, number> = {
  MODERATOR: 0,
  PANELIST: 1,
  KEYNOTE: 2,
  GUEST_OF_HONOR: 3,
};

/** Rang d'un rôle ; un rôle inconnu passe après les autres. */
function rang(role: string): number {
  return RANG_ROLE[role] ?? Object.keys(RANG_ROLE).length;
}

/** Les intervenants triés par rôle, l'ordre d'origine conservé à rôle égal. */
export function ordonnerIntervenants<T extends { role: string }>(liens: T[]): T[] {
  return [...liens].sort((a, b) => rang(a.role) - rang(b.role));
}
