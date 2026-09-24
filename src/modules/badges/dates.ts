/**
 * Dates du Forum, telles qu'elles s'écrivent sur un badge (§33).
 *
 * Le badge est imprimé et mesure 54 mm de large : chaque caractère compte.
 * « 23 novembre 2026 – 25 novembre 2026 » y tiendrait sur trois lignes et
 * répéterait deux fois le mois et l'année. La forme retenue les factorise :
 *
 * | Cas                          | Rendu                         |
 * | ---------------------------- | ----------------------------- |
 * | Même mois                    | 23–25 novembre 2026           |
 * | Mois différents, même année  | 30 novembre – 2 décembre 2026 |
 * | Années différentes           | 30 décembre 2026 – 2 janvier 2027 |
 * | Un seul jour                 | 23 novembre 2026              |
 *
 * `Africa/Dakar` explicitement : le serveur tourne en UTC et les dates sont
 * stockées à minuit. Sans fuseau, une bascule d'heure rendrait « 22 novembre »
 * un badge pour un Forum qui ouvre le 23.
 *
 * Le tiret est un tiret demi-cadratin (–) et non un trait d'union : c'est le
 * signe de l'intervalle en typographie française, et il se distingue du trait
 * d'union des noms composés.
 */
const FUSEAU = "Africa/Dakar";

function partie(date: Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("fr-FR", { ...options, timeZone: FUSEAU }).format(date);
}

export function datesDuForum(debut: Date, fin: Date): string {
  const jourDebut = partie(debut, { day: "numeric" });
  const jourFin = partie(fin, { day: "numeric" });
  const moisDebut = partie(debut, { month: "long" });
  const moisFin = partie(fin, { month: "long" });
  const anneeDebut = partie(debut, { year: "numeric" });
  const anneeFin = partie(fin, { year: "numeric" });

  if (anneeDebut !== anneeFin) {
    return `${jourDebut} ${moisDebut} ${anneeDebut} – ${jourFin} ${moisFin} ${anneeFin}`;
  }
  if (moisDebut !== moisFin) {
    return `${jourDebut} ${moisDebut} – ${jourFin} ${moisFin} ${anneeFin}`;
  }
  if (jourDebut === jourFin) {
    return `${jourDebut} ${moisDebut} ${anneeFin}`;
  }
  return `${jourDebut}–${jourFin} ${moisDebut} ${anneeFin}`;
}
