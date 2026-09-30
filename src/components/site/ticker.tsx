import { getLocale, getTranslations } from "next-intl/server";
import { getActiveEdition } from "@/lib/edition";
import { plageDeDates } from "@/lib/dates-edition";

/**
 * Bandeau défilant du haut de page (brief « Constellation » §3).
 *
 * Nom, lieu et dates viennent de l'édition active ; les autres messages, des
 * fichiers de traduction. La liste est posée **deux fois** sur la piste, qui
 * recule de la moitié de sa largeur : la boucle reprend sans à-coup.
 *
 * `aria-hidden` : ce sont des rappels décoratifs de ce que la page dit déjà,
 * et un texte qui défile se lit mal à la synthèse vocale.
 */
export async function Ticker() {
  const t = await getTranslations("constellation.ticker");
  const locale = await getLocale();
  const edition = await getActiveEdition();

  const items = [
    edition.title,
    t("dates", {
      venue: edition.venue,
      dates: plageDeDates(edition.startDate, edition.endDate, locale),
    }),
    t("registrations"),
    t("translation"),
    t("motto"),
  ];

  return (
    <div
      className="bandeau-defilant fond-entete h-8 overflow-hidden text-[0.8rem] leading-8 font-semibold whitespace-nowrap text-white"
      aria-hidden
    >
      <div className="bandeau-defilant__piste">
        {[...items, ...items].map((item, rang) => (
          <span key={rang}>{item}</span>
        ))}
      </div>
    </div>
  );
}
