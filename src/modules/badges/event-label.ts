/** Intitulé et dates de l'édition, tels qu'affichés lors d'un contrôle de badge. */
export function formatEventLabel(edition: {
  title: string;
  startDate: Date;
  endDate: Date;
}): string {
  const formatter = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Dakar",
  });
  const dayOnly = new Intl.DateTimeFormat("fr-FR", { day: "numeric", timeZone: "Africa/Dakar" });

  const sameMonth =
    edition.startDate.getUTCFullYear() === edition.endDate.getUTCFullYear() &&
    edition.startDate.getUTCMonth() === edition.endDate.getUTCMonth();

  const range = sameMonth
    ? `${dayOnly.format(edition.startDate)}–${formatter.format(edition.endDate)}`
    : `${formatter.format(edition.startDate)} – ${formatter.format(edition.endDate)}`;

  return `${edition.title}, ${range}`;
}
