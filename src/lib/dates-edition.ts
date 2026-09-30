import { localeIntl } from "./langue";

/**
 * Dates de l'édition, écrites d'un seul tenant quand elles tombent dans le même
 * mois : « 23 - 25 Novembre 2026 » (demande du commanditaire, 28 septembre
 * 2026), et non plus « 23 novembre 2026 – 25 novembre 2026 ». Le mois prend
 * une capitale, comme demandé.
 *
 * Le portugais relie jour, mois et année par « de » : « 23 - 25 de Novembro
 * de 2026 ».
 */
export function plageDeDates(debut: Date, fin: Date, langue: string): string {
  const locale = localeIntl(langue);
  const de = langue === "pt" ? " de" : "";
  const partie = (date: Date, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone: "Africa/Dakar" }).format(date);
  const mois = (date: Date) => {
    const nom = partie(date, { month: "long" });
    return nom.charAt(0).toLocaleUpperCase(locale) + nom.slice(1);
  };
  const jour = (date: Date) => partie(date, { day: "numeric" });
  const annee = (date: Date) => partie(date, { year: "numeric" });

  if (annee(debut) === annee(fin) && mois(debut) === mois(fin)) {
    return `${jour(debut)} - ${jour(fin)}${de} ${mois(fin)}${de} ${annee(fin)}`;
  }
  if (annee(debut) === annee(fin)) {
    return `${jour(debut)}${de} ${mois(debut)} - ${jour(fin)}${de} ${mois(fin)}${de} ${annee(fin)}`;
  }
  return `${jour(debut)}${de} ${mois(debut)}${de} ${annee(debut)} - ${jour(fin)}${de} ${mois(fin)}${de} ${annee(fin)}`;
}
