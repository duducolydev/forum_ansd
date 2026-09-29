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
  const locale = (await getLocale()) as "fr" | "en";
  const edition = await getActiveEdition();
  const album = await albumPublie(edition.id, slug);
  if (!album) return {};
  return { title: `${resolveLocaleValue(album.titleFr, album.titleEn, locale)} — Médiathèque` };
}

export default async function AlbumPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = (await getLocale()) as "fr" | "en";
  const en = locale === "en";
  const edition = await getActiveEdition();
  const album = await albumPublie(edition.id, slug);
  if (!album) notFound();

  const titre = resolveLocaleValue(album.titleFr, album.titleEn, locale);
  const description = resolveLocaleValue(
    album.descriptionFr ?? "",
    album.descriptionEn ?? "",
    locale,
  );
  const date = album.eventDate
    ? new Intl.DateTimeFormat(en ? "en-GB" : "fr-FR", {
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
          {en ? "Media library" : "Médiathèque"}
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
            {en ? "This album is empty for now." : "Cet album est vide pour l'instant."}
          </p>
        ) : (
          <Galerie elements={album.items.map((item) => versElementGalerie(item, locale))} en={en} />
        )}
      </CorpsPage>
    </>
  );
}
