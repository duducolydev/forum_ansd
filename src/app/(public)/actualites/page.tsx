import { selon, traduire, type Langue } from "@/lib/langue";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, ArrowRight, Newspaper } from "lucide-react";
import { getActiveEdition } from "@/lib/edition";
import { listPosts } from "@/modules/content/service";
import { EnteteSection } from "@/components/site/entete-section";
import { BandeauPage, CorpsPage } from "@/components/site/bandeau-page";
import { NewsTimeline } from "@/components/home/NewsTimeline";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("news") };
}

/** Articles par page de la frise. */
const PAR_PAGE = 8;

/**
 * Actualités (§26), habillage « Constellation » (brief §6) : la frise de
 * l'accueil, paginée — trait qui se remplit, cartes en alternance, visuel de
 * couverture ou visuel génératif propre à chaque article.
 */
export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const t = await getTranslations("nav");
  const tPage = await getTranslations("newsPage");
  const locale = (await getLocale()) as Langue;
  const edition = await getActiveEdition();
  const posts = await listPosts(edition.id, { onlyPublished: true });

  const pages = Math.max(1, Math.ceil(posts.length / PAR_PAGE));
  const demandee = Number.parseInt((await searchParams).page ?? "1", 10);
  const page = Number.isFinite(demandee) ? Math.min(Math.max(demandee, 1), pages) : 1;
  const affiches = posts.slice((page - 1) * PAR_PAGE, page * PAR_PAGE);

  return (
    <>
      <BandeauPage>
        <EnteteSection
          bandeau
          niveau="h1"
          surtitre={selon(locale, {
            fr: "Suivre le Forum",
            en: "Follow the Forum",
            pt: "Acompanhar o Fórum",
          })}
          titre={t("news")}
          icone={Newspaper}
        />
      </BandeauPage>

      <CorpsPage>
        {posts.length === 0 ? (
          <p className="border-border bg-surface text-text-3 rounded-xl border p-8 text-center">
            {tPage("empty")}
          </p>
        ) : (
          <>
            <NewsTimeline
              key={page}
              locale={locale}
              niveau="h2"
              prioritaire
              articles={affiches.map((post) => ({
                id: post.id,
                href: `/actualites/${post.slug}`,
                titre: traduire(locale, { fr: post.titleFr, en: post.titleEn, pt: post.titlePt }),
                date: (post.publishedAt ?? post.createdAt).toISOString(),
                couverture: post.coverPath ? `/api/v1/posts/${post.id}/image/couverture` : null,
                etiquette: selon(locale, { fr: "ACTUALITÉ", en: "NEWS", pt: "NOTÍCIA" }),
              }))}
            />

            {pages > 1 && (
              <nav
                aria-label={selon(locale, { fr: "Pages", en: "Pages", pt: "Páginas" })}
                className="mt-14 flex flex-wrap items-center justify-center gap-3"
              >
                {page > 1 && (
                  <Link
                    href={page - 1 === 1 ? "/actualites" : `/actualites?page=${page - 1}`}
                    className="inline-flex items-center gap-1.5 font-semibold text-[var(--title)]"
                  >
                    <ArrowLeft aria-hidden size={16} />
                    {selon(locale, { fr: "Plus récentes", en: "Newer", pt: "Mais recentes" })}
                  </Link>
                )}
                <span className="police-grotesk text-sm text-[var(--muted)]">
                  {page} / {pages}
                </span>
                {page < pages && (
                  <Link
                    href={`/actualites?page=${page + 1}`}
                    className="inline-flex items-center gap-1.5 font-semibold text-[var(--title)]"
                  >
                    {selon(locale, { fr: "Plus anciennes", en: "Older", pt: "Mais antigas" })}
                    <ArrowRight aria-hidden size={16} />
                  </Link>
                )}
              </nav>
            )}
          </>
        )}
      </CorpsPage>
    </>
  );
}
