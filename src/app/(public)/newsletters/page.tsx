import { lireLangue, localeIntl, selon } from "@/lib/langue";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { Download, Mails } from "lucide-react";
import { getActiveEdition } from "@/lib/edition";
import { resolveLocaleValue } from "@/modules/content/service";
import { listerPubliees, urlFichier } from "@/modules/newsletters/service";
import { poidsLisible } from "@/modules/newsletters/schema";
import { EnteteSection } from "@/components/site/entete-section";
import { BandeauPage, CorpsPage } from "@/components/site/bandeau-page";
import { LienSiteExterne } from "@/components/site/bouton-site";
import { RevealListe } from "@/components/site/reveal-liste";

export const metadata = { title: "Newsletters" };

/*
 * La liste se recalcule à chaque visite : une newsletter publiée doit
 * apparaître tout de suite, pas au prochain déploiement.
 */
export const dynamic = "force-dynamic";

/**
 * Newsletters du Forum (§34) : la liste, la plus récente d'abord, chacune avec
 * son fichier de synthèse à télécharger (25 novembre 2026).
 */
export default async function NewslettersPage() {
  const locale = lireLangue(await getLocale());
  const intl = localeIntl(locale);
  const dateLongue = new Intl.DateTimeFormat(intl, {
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
              <article
                key={newsletter.id}
                className="border-border bg-surface carte-relief rounded-xl border p-6"
              >
                {newsletter.publishedAt && (
                  <span className="text-text-3 text-xs">
                    {dateLongue.format(newsletter.publishedAt)}
                  </span>
                )}
                {/* `h2` : la page n'a qu'un `h1`, sauter un palier désoriente la
                    navigation par titres. */}
                <h2 className="font-display text-heading mt-1 text-lg leading-snug">
                  <Link href={`/newsletters/${newsletter.slug}`} className="hover:text-link">
                    {resolveLocaleValue(
                      newsletter.titleFr,
                      newsletter.titleEn,
                      locale,
                      newsletter.titlePt,
                    )}
                  </Link>
                </h2>
                <p className="text-text-2 mt-2 leading-relaxed whitespace-pre-line">
                  {resolveLocaleValue(
                    newsletter.excerptFr,
                    newsletter.excerptEn,
                    locale,
                    newsletter.excerptPt,
                  )}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  {newsletter.filePath ? (
                    <LienSiteExterne
                      href={urlFichier(newsletter.id)}
                      icone={Download}
                      taille="compact"
                    >
                      {selon(locale, {
                        fr: "Télécharger le PDF",
                        en: "Download the PDF",
                        pt: "Descarregar o PDF",
                      })}
                      {newsletter.fileSize ? ` · ${poidsLisible(newsletter.fileSize, intl)}` : ""}
                    </LienSiteExterne>
                  ) : (
                    <Link
                      href={`/newsletters/${newsletter.slug}`}
                      className="text-link text-sm font-semibold"
                    >
                      {selon(locale, { fr: "Lire", en: "Read", pt: "Ler" })}
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </RevealListe>
        )}
      </CorpsPage>
    </>
  );
}
