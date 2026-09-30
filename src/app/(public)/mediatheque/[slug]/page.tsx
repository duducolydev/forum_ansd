import { localeIntl, selon, type Langue } from "@/lib/langue";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { ArrowLeft, Images } from "lucide-react";
import { getActiveEdition } from "@/lib/edition";
import { EnteteSection } from "@/components/site/entete-section";
import { BandeauPage, CorpsPage } from "@/components/site/bandeau-page";
import { resolveLocaleValue } from "@/modules/content/service";
import { albumPublie, versElementGalerie } from "@/modules/medias/service";
import { Galerie } from "@/modules/medias/components/galerie";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = (await getLocale()) as Langue;
  const edition = await getActiveEdition();
  const album = await albumPublie(edition.id, slug);
  if (!album) return {};
  return {
    title: `${resolveLocaleValue(album.titleFr, album.titleEn, locale, album.titlePt)} — Médiathèque`,
  };
}

export default async function AlbumPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = (await getLocale()) as Langue;
  const edition = await getActiveEdition();
  const album = await albumPublie(edition.id, slug);
  if (!album) notFound();

  const titre = resolveLocaleValue(album.titleFr, album.titleEn, locale, album.titlePt);
  const description = resolveLocaleValue(
    album.descriptionFr ?? "",
    album.descriptionEn ?? "",
    locale,
    album.descriptionPt,
  );
  const date = album.eventDate
    ? new Intl.DateTimeFormat(localeIntl(locale), {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(album.eventDate)
    : null;

  return (
    <>
      <BandeauPage>
        <EnteteSection bandeau niveau="h1" titre={titre} icone={Images} />
      </BandeauPage>

      <CorpsPage>
        <Link
          href="/mediatheque"
          className="text-link mb-6 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft aria-hidden size={15} />
          {selon(locale, { fr: "Médiathèque", en: "Media library", pt: "Mediateca" })}
        </Link>
        {(date || description) && (
          <div className="mb-8 max-w-[70ch]">
            {date && <p className="text-text-3 text-sm font-semibold">{date}</p>}
            {description && (
              <p className="text-text-2 mt-2 text-lg leading-relaxed whitespace-pre-line">
                {description}
              </p>
            )}
          </div>
        )}
        {album.items.length === 0 ? (
          <p className="border-border bg-surface text-text-3 rounded-xl border p-8 text-center">
            {selon(locale, {
              fr: "Cet album est vide pour l'instant.",
              en: "This album is empty for now.",
              pt: "Este álbum ainda está vazio.",
            })}
          </p>
        ) : (
          <Galerie
            elements={album.items.map((item) => versElementGalerie(item, locale))}
            locale={locale}
          />
        )}
      </CorpsPage>
    </>
  );
}
