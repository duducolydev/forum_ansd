import { localeIntl } from "@/lib/langue";

/** Une journée du Forum : sa date ISO (valeur enregistrée) et son libellé. */
export interface JourForum {
  value: string;
  label: string;
}

/**
 * Journées du Forum, dérivées des dates de l'édition (pas de dates en dur).
 *
 * Partagé par l'inscription et « Mon espace » : les deux doivent proposer
 * exactement les mêmes valeurs, sans quoi une journée cochée à l'inscription
 * apparaîtrait décochée au moment de la modifier.
 */
export function joursDuForum(start: Date, end: Date, locale: string): JourForum[] {
  const formatter = new Intl.DateTimeFormat(localeIntl(locale), {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Africa/Dakar",
  });
  const days: JourForum[] = [];
  const cursor = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
  );
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));

  while (cursor <= last && days.length < 10) {
    days.push({ value: cursor.toISOString().slice(0, 10), label: formatter.format(cursor) });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}
