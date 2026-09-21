import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { ArrowLeft, CalendarDays, Newspaper, UserPlus } from "lucide-react";
import { getActiveEdition } from "@/lib/edition";
import { lireTexteRiche, texteBrut } from "@/lib/texte-riche";
import { TexteRiche } from "@/components/site/texte-riche";
import { getPostBySlug, resolveLocaleValue } from "@/modules/content/service";
import { lireGalerie } from "@/modules/content/schema";
import { BandeauPage, CorpsPage } from "@/components/site/bandeau-page";
import { LienSite } from "@/components/site/bouton-site";
import { Reveal } from "@/components/site/reveal";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const edition = await getActiveEdition();
  const post = await getPostBySlug(edition.id, slug);
  if (!post) return {};

  /*
   * Le chapô a été écrit pour cela : le corps tronqué à 160 signes coupait au
   * milieu d'un mot dans tous les aperçus partagés. À défaut de chapô, c'est le
   * **texte visible** du corps qui sert — depuis §26 il est mis en forme, et
   * publier son balisage dans une balise `description` afficherait des accolades
   * dans les résultats de recherche.
   */
  const description =
    post.excerptFr?.trim() || texteBrut(lireTexteRiche(post.bodyFr)).slice(0, 160);
  return {
    title: post.titleFr,
    openGraph: {
      title: post.titleFr,
      description,
      images: post.coverPath ? [`/api/v1/posts/${post.id}/image/couverture`] : undefined,
    },
  };
}

export default async function NewsDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  const en = locale === "en";
  const edition = await getActiveEdition();
  const post = await getPostBySlug(edition.id, slug);
  if (!post || !post.isPublished) notFound();

  const chapo = resolveLocaleValue(post.excerptFr, post.excerptEn, locale);
  const galerie = lireGalerie(post.gallery);
  const date = post.publishedAt
    ? new Intl.DateTimeFormat(en ? "en-GB" : "fr-FR", {
        dateStyle: "long",
        timeZone: "Africa/Dakar",
      }).format(post.publishedAt)
    : null;

  return (
    <article>
      <BandeauPage largeur="moyen">
        {/*
         * Le retour au fil d'actualité est placé avant le titre et porte une
         * flèche : sur téléphone, le bouton « précédent » du navigateur est le
         * seul chemin de retour, et il disparaît quand la page a été ouverte
         * depuis un lien partagé.
         */}
        <LienSite href="/actualites" ton="discret" taille="compact" icone={ArrowLeft}>
          {en ? "All news" : "Toutes les actualités"}
        </LienSite>

        <h1 className="mt-2 mb-1">{en ? post.titleEn : post.titleFr}</h1>

        {date && (
          <p className="text-text-3 flex items-center gap-1.5 text-sm">
            <CalendarDays aria-hidden size={14} />
            <time dateTime={post.publishedAt?.toISOString()}>{date}</time>
          </p>
        )}
      </BandeauPage>

      <CorpsPage largeur="moyen">
        {chapo && (
          <p className="text-heading border-accent-text mb-8 border-l-2 pl-5 text-xl leading-relaxed font-medium">
            {chapo}
          </p>
        )}

        {post.coverPath && (
          <Reveal>
            {/* eslint-disable-next-line @next/next/no-img-element -- servie par une route contrôlée, hors optimiseur */}
            <img
              src={`/api/v1/posts/${post.id}/image/couverture`}
              alt=""
              className="border-border bg-bg-2 mb-9 w-full rounded-2xl border object-cover shadow-sm"
            />
          </Reveal>
        )}

        <TexteRiche
          valeur={en ? post.bodyEn : post.bodyFr}
          className="text-text-2 text-lg leading-relaxed"
        />

        {galerie.length > 0 && (
          <div className="mt-12">
            <h2 className="mb-5 flex items-center gap-4 text-base">
              <span className="surtitre">{en ? "Gallery" : "Galerie"}</span>
              <span className="from-border h-px flex-1 bg-gradient-to-r to-transparent" />
            </h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {galerie.map((image, rang) => {
                const legende = resolveLocaleValue(image.captionFr, image.captionEn, locale);
                return (
                  <Reveal key={image.path} delai={rang * 70}>
                    <figure className="border-border bg-surface carte-relief overflow-hidden rounded-xl border">
                      {/* eslint-disable-next-line @next/next/no-img-element -- servie par une route contrôlée, hors optimiseur */}
                      <img
                        src={`/api/v1/posts/${post.id}/image/${rang}`}
                        alt={legende}
                        className="vignette"
                      />
                      {legende && (
                        <figcaption className="text-text-3 border-border border-t px-4 py-2.5 text-sm">
                          {legende}
                        </figcaption>
                      )}
                    </figure>
                  </Reveal>
                );
              })}
            </div>
          </div>
        )}

        <div className="border-border mt-12 flex flex-wrap gap-3 border-t pt-8">
          <LienSite href="/actualites" icone={Newspaper}>
            {en ? "Other news" : "Autres actualités"}
          </LienSite>
          <LienSite href="/inscription" ton="principal" icone={UserPlus}>
            {en ? "Register for the Forum" : "S'inscrire au Forum"}
          </LienSite>
        </div>
      </CorpsPage>
    </article>
  );
}
