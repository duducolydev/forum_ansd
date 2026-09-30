import { lireLangue, localeIntl, selon } from "@/lib/langue";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { ArrowRight, Mails } from "lucide-react";
import { getActiveEdition } from "@/lib/edition";
import { resolveLocaleValue } from "@/modules/content/service";
import { listerPubliees } from "@/modules/newsletters/service";
import { EnteteSection } from "@/components/site/entete-section";
import { BandeauPage, CorpsPage } from "@/components/site/bandeau-page";
import { RevealListe } from "@/components/site/reveal-liste";

export const metadata = { title: "Newsletters" };

/*
 * La liste se recalcule à chaque visite : une newsletter publiée doit
 * apparaître tout de suite, pas au prochain déploiement.
 */
export const dynamic = "force-dynamic";

/** Newsletters du Forum (§34) : la liste, la plus récente d'abord. */
export default async function NewslettersPage() {
  const locale = lireLangue(await getLocale());
  const dateLongue = new Intl.DateTimeFormat(localeIntl(locale), {
    dateStyle: "long",
    timeZone: "Africa/Dakar",
  });
  const edition = await getActiveEdition();
  const newsletters = await listerPubliees(edition.id);

  return (
    <>
      <BandeauPage largeur="moyen">
        <EnteteSection
          bandeau
          niveau="h1"
          titre={selon(locale, { fr: "Newsletters", en: "Newsletters", pt: "Newsletters" })}
          icone={Mails}
        />
      </BandeauPage>

      <CorpsPage largeur="moyen">
        {newsletters.length === 0 ? (
          <p className="border-border bg-surface text-text-3 rounded-xl border p-8 text-center">
            {selon(locale, {
              fr: "Aucune newsletter publiée pour l'instant.",
              en: "No newsletter published yet.",
              pt: "Ainda não foi publicada nenhuma newsletter.",
            })}
          </p>
        ) : (
          <RevealListe className="flex flex-col gap-4">
            {newsletters.map((newsletter) => (
              <Link
                key={newsletter.id}
                href={`/newsletters/${newsletter.slug}`}
                className="border-border bg-surface carte-relief hover:border-link group block rounded-xl border p-6 transition-colors"
              >
                {newsletter.publishedAt && (
                  <span className="text-text-3 text-xs">
                    {dateLongue.format(newsletter.publishedAt)}
                  </span>
                )}
                {/* `h2` : la page n'a qu'un `h1`, sauter un palier désoriente la
                    navigation par titres. */}
                <h2 className="font-display text-heading mt-1 text-lg leading-snug">
                  {resolveLocaleValue(
                    newsletter.titleFr,
                    newsletter.titleEn,
                    locale,
                    newsletter.titlePt,
                  )}
                </h2>
                <p className="text-text-2 mt-2 leading-relaxed">
                  {resolveLocaleValue(
                    newsletter.excerptFr,
                    newsletter.excerptEn,
                    locale,
                    newsletter.excerptPt,
                  )}
                </p>
                <span className="text-link mt-3 flex items-center gap-1.5 text-sm font-semibold">
                  {selon(locale, { fr: "Lire", en: "Read", pt: "Ler" })}
                  <ArrowRight
                    aria-hidden
                    size={15}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </span>
              </Link>
            ))}
          </RevealListe>
        )}
      </CorpsPage>
    </>
  );
}
