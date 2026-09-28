/**
 * Dates de l'édition, écrites d'un seul tenant quand elles tombent dans le même
 * mois : « 23 - 25 Novembre 2026 » (demande du commanditaire, 28 septembre
 * 2026), et non plus « 23 novembre 2026 – 25 novembre 2026 ». Le mois prend
 * une capitale, comme demandé.
 */
export function plageDeDates(debut: Date, fin: Date, en: boolean): string {
  const langue = en ? "en-GB" : "fr-FR";
  const partie = (date: Date, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(langue, { ...options, timeZone: "Africa/Dakar" }).format(date);
  const mois = (date: Date) => {
    const nom = partie(date, { month: "long" });
    return nom.charAt(0).toLocaleUpperCase(langue) + nom.slice(1);
  };
  const jour = (date: Date) => partie(date, { day: "numeric" });
  const annee = (date: Date) => partie(date, { year: "numeric" });

  if (annee(debut) === annee(fin) && mois(debut) === mois(fin)) {
    return `${jour(debut)} - ${jour(fin)} ${mois(fin)} ${annee(fin)}`;
  }
  if (annee(debut) === annee(fin)) {
    return `${jour(debut)} ${mois(debut)} - ${jour(fin)} ${mois(fin)} ${annee(fin)}`;
  }
  return `${jour(debut)} ${mois(debut)} ${annee(debut)} - ${jour(fin)} ${mois(fin)} ${annee(fin)}`;
}
