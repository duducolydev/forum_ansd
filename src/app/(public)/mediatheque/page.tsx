import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import {
  ArrowLeft,
  ArrowRight,
  Film,
  FolderOpen,
  ImageIcon,
  Images,
  Newspaper,
} from "lucide-react";
import { getActiveEdition } from "@/lib/edition";
import { EnteteSection } from "@/components/site/entete-section";
import { BandeauPage, CorpsPage } from "@/components/site/bandeau-page";
import { resolveLocaleValue } from "@/modules/content/service";
import {
  albumsPublies,
  imagesActualites,
  photosPubliques,
  versElementGalerie,
  videosPubliques,
} from "@/modules/medias/service";
import { Galerie } from "@/modules/medias/components/galerie";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("mediaLibrary") };
}

type Vue = "albums" | "photos" | "videos" | "actualites";
const VUES: Vue[] = ["albums", "photos", "videos", "actualites"];

const LIBELLES: Record<Vue, { fr: string; en: string; icone: typeof Images }> = {
  albums: { fr: "Albums", en: "Albums", icone: FolderOpen },
  photos: { fr: "Photos", en: "Photos", icone: ImageIcon },
  videos: { fr: "Vidéos", en: "Videos", icone: Film },
  actualites: { fr: "Actualités", en: "News", icone: Newspaper },
};

function dateLisible(date: Date | null, en: boolean): string | null {
  return date
    ? new Intl.DateTimeFormat(en ? "en-GB" : "fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(date)
    : null;
}

function Vide({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-border bg-surface text-text-3 rounded-xl border p-8 text-center">
      {children}
    </p>
  );
}

/**
 * Médiathèque (29 septembre 2026) : albums, photos et vidéos du Forum, et les
 * images des actualités, reprises d'elles-mêmes — onglet par onglet, pour ne
 * charger que ce que le visiteur regarde.
 */
export default async function MediathequePage({
  searchParams,
}: {
  searchParams: Promise<{ vue?: string; page?: string }>;
}) {
  const t = await getTranslations("nav");
  const locale = (await getLocale()) as "fr" | "en";
  const en = locale === "en";
  const edition = await getActiveEdition();
  const parametres = await searchParams;
  const vue: Vue = VUES.includes(parametres.vue as Vue) ? (parametres.vue as Vue) : "albums";
  const lien = (cible: Vue) => (cible === "albums" ? "/mediatheque" : `/mediatheque?vue=${cible}`);

  let contenu: React.ReactNode;

  if (vue === "albums") {
    const albums = await albumsPublies(edition.id);
    contenu =
      albums.length === 0 ? (
        <Vide>
          {en
            ? "No album yet. Photos and videos will be published during the Forum."
            : "Aucun album pour l'instant. Photos et vidéos seront publiées au fil du Forum."}
        </Vide>
      ) : (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((album) => {
            const titre = resolveLocaleValue(album.titleFr, album.titleEn, locale);
            const date = dateLisible(album.eventDate, en);
            const decompte = [
              album.photos > 0 && `${album.photos} photo${album.photos > 1 ? "s" : ""}`,
              album.videos > 0 &&
                `${album.videos} ${en ? "video" : "vidéo"}${album.videos > 1 ? "s" : ""}`,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={album.id}>
                <Link
                  href={`/mediatheque/${album.slug}`}
                  className="group border-border bg-surface carte-relief flex h-full flex-col overflow-hidden rounded-2xl border"
                >
                  <div className="bg-bg-3 relative aspect-[16/10] overflow-hidden">
                    {album.vignette ? (
                      /* eslint-disable-next-line @next/next/no-img-element -- servie par une route contrôlée */
                      <img
                        src={album.vignette}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <span className="text-text-3 grid h-full place-items-center">
                        <Images aria-hidden size={36} />
                      </span>
                    )}
                    <span className="absolute right-3 bottom-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                      {decompte}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-5">
                    <h2 className="text-heading font-display text-lg font-semibold group-hover:text-[var(--title)]">
                      {titre}
                    </h2>
                    {date && <p className="text-text-3 text-sm">{date}</p>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      );
  } else if (vue === "photos") {
    const demandee = Number.parseInt(parametres.page ?? "1", 10);
    const resultat = await photosPubliques(
      edition.id,
      locale,
      Number.isFinite(demandee) ? demandee : 1,
    );
    contenu =
      resultat.total === 0 ? (
        <Vide>{en ? "No photo yet." : "Aucune photo pour l'instant."}</Vide>
      ) : (
        <>
          <Galerie key={resultat.page} elements={resultat.elements} en={en} />
          {resultat.pages > 1 && (
            <nav
              aria-label="Pages"
              className="mt-12 flex flex-wrap items-center justify-center gap-3"
            >
              {resultat.page > 1 && (
                <Link
                  href={`/mediatheque?vue=photos&page=${resultat.page - 1}`}
                  className="inline-flex items-center gap-1.5 font-semibold text-[var(--title)]"
                >
                  <ArrowLeft aria-hidden size={16} />
                  {en ? "Newer" : "Plus récentes"}
                </Link>
              )}
              <span className="police-grotesk text-sm text-[var(--muted)]">
                {resultat.page} / {resultat.pages}
              </span>
              {resultat.page < resultat.pages && (
                <Link
                  href={`/mediatheque?vue=photos&page=${resultat.page + 1}`}
                  className="inline-flex items-center gap-1.5 font-semibold text-[var(--title)]"
                >
                  {en ? "Older" : "Plus anciennes"}
                  <ArrowRight aria-hidden size={16} />
                </Link>
              )}
            </nav>
          )}
        </>
      );
  } else if (vue === "videos") {
    const videos = await videosPubliques(edition.id);
    contenu =
      videos.length === 0 ? (
        <Vide>{en ? "No video yet." : "Aucune vidéo pour l'instant."}</Vide>
      ) : (
        <Galerie elements={videos.map((video) => versElementGalerie(video, locale))} en={en} />
      );
  } else {
    const groupes = await imagesActualites(edition.id, locale);
    contenu =
      groupes.length === 0 ? (
        <Vide>{en ? "No news image yet." : "Aucune image d'actualité pour l'instant."}</Vide>
      ) : (
        <div className="flex flex-col gap-12">
          {groupes.map((groupe) => (
            <section key={groupe.article.href}>
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="text-heading font-display text-lg font-semibold">
                  <Link href={groupe.article.href} className="hover:text-[var(--title)]">
                    {groupe.article.titre}
                  </Link>
                </h2>
                <span className="text-text-3 text-sm">
                  {dateLisible(groupe.article.date, en)}
                  {" · "}
                  <Link
                    href={groupe.article.href}
                    className="text-link underline underline-offset-2"
                  >
                    {en ? "Read the article" : "Lire l'article"}
                  </Link>
                </span>
              </div>
              <Galerie elements={groupe.images} en={en} />
            </section>
          ))}
        </div>
      );
  }

  return (
    <>
      <BandeauPage>
        <EnteteSection bandeau niveau="h1" titre={t("mediaLibrary")} icone={Images} />
      </BandeauPage>

      <CorpsPage>
        <nav
          aria-label={en ? "Media library sections" : "Rubriques de la médiathèque"}
          className="mb-8"
        >
          <ul className="flex flex-wrap gap-2">
            {VUES.map((cible) => {
              const { icone: Icone, ...libelle } = LIBELLES[cible];
              const actif = cible === vue;
              return (
                <li key={cible}>
                  <Link
                    href={lien(cible)}
                    aria-current={actif ? "page" : undefined}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                      actif
                        ? "border-transparent bg-[var(--title)] text-white"
                        : "border-border bg-surface text-heading hover:border-[var(--title)]"
                    }`}
                  >
                    <Icone aria-hidden size={16} />
                    {en ? libelle.en : libelle.fr}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        {contenu}
      </CorpsPage>
    </>
  );
}
