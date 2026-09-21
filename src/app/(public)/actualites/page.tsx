import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, Clock, Newspaper } from "lucide-react";
import { getActiveEdition } from "@/lib/edition";
import { listPosts, resolveLocaleValue } from "@/modules/content/service";
import { EnteteSection } from "@/components/site/entete-section";
import { BandeauPage, CorpsPage } from "@/components/site/bandeau-page";
import { Reveal } from "@/components/site/reveal";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("news") };
}

export default async function NewsPage() {
  const t = await getTranslations("nav");
  const tPage = await getTranslations("newsPage");
  const locale = (await getLocale()) as "fr" | "en";
  const edition = await getActiveEdition();
  const posts = await listPosts(edition.id, { onlyPublished: true });
  const en = locale === "en";

  return (
    <>
      <BandeauPage>
        <EnteteSection
          bandeau
          niveau="h1"
          surtitre={en ? "Keep up" : "Suivre le Forum"}
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
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {posts.map((post, rang) => {
              const chapo = resolveLocaleValue(post.excerptFr, post.excerptEn, locale);
              return (
                <Reveal key={post.id} delai={rang * 70} className="h-full">
                  <Link
                    href={`/actualites/${post.slug}`}
                    className="border-border bg-surface carte-lien h-full rounded-xl border"
                  >
                    {/*
                     * Le cadre média est toujours présent : une grille mêlant
                     * articles illustrés et non illustrés décalait les titres
                     * d'une carte à l'autre.
                     */}
                    <span className="bg-bg-2 border-border block border-b">
                      {post.coverPath ? (
                        /* eslint-disable-next-line @next/next/no-img-element -- servie par une route contrôlée, hors optimiseur */
                        <img
                          src={`/api/v1/posts/${post.id}/image/couverture`}
                          alt=""
                          className="vignette"
                        />
                      ) : (
                        <span className="vignette from-bg-2 to-bg-3 grid place-items-center bg-gradient-to-br">
                          <Newspaper aria-hidden size={30} className="text-text-3 opacity-45" />
                        </span>
                      )}
                    </span>

                    <span className="flex flex-1 flex-col p-5.5">
                      <span className="text-text-3 flex items-center gap-1.5 text-sm">
                        <Clock aria-hidden size={13} />
                        {post.publishedAt
                          ? new Intl.DateTimeFormat(locale).format(post.publishedAt)
                          : ""}
                      </span>
                      {/* `h2` et non `h3` : la page n'a qu'un `h1`, et sauter un
                          niveau désoriente la navigation par titres. */}
                      <h2 className="titre-carte mt-2 text-lg leading-snug">
                        {en ? post.titleEn : post.titleFr}
                      </h2>
                      {chapo && (
                        <span className="text-text-2 mt-2 block text-sm leading-relaxed">
                          {chapo}
                        </span>
                      )}
                      <span className="text-link mt-auto flex items-center gap-1.5 pt-4 text-sm font-semibold">
                        {en ? "Read" : "Lire"}
                        <ArrowRight aria-hidden size={14} />
                      </span>
                    </span>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        )}
      </CorpsPage>
    </>
  );
}
