"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { mouvementReduit } from "@/components/motion/hooks";

const NewsCanvas = dynamic(() => import("./NewsCanvas"), { ssr: false });

export interface ArticleFrise {
  id: string;
  href: string;
  titre: string;
  /** Date de publication, ISO. */
  date: string;
  /** Couverture de l'article, s'il en a une. */
  couverture: string | null;
  /** Étiquette du visuel : « ACTUALITÉ », « NEWSLETTER »… */
  etiquette: string;
}

/**
 * Frise verticale des actualités (brief §4.4).
 *
 * Un trait dégradé vert → or → rouge se remplit avec le défilement (jusqu'à
 * 60 % de la fenêtre) ; chaque entrée s'allume en le franchissant : le point
 * s'éclaire et pulse, la carte arrive en alternance de gauche et de droite, la
 * grande date en contour se colore.
 *
 * Sans JavaScript et sous mouvement réduit, tout est dans son état final
 * (cartes visibles, trait plein). Sur téléphone, la frise passe à gauche et
 * les cartes s'empilent.
 */
export function NewsTimeline({
  articles,
  locale,
  niveau = "h3",
  prioritaire = false,
}: {
  articles: ArticleFrise[];
  locale: "fr" | "en";
  /** `h2` sur la page Actualités, qui n'a pas d'autre intertitre ; `h3` sur l'accueil. */
  niveau?: "h2" | "h3";
  /** Première couverture chargée en priorité : c'est l'image du premier écran (LCP). */
  prioritaire?: boolean;
}) {
  const Titre = niveau;
  const t = useTranslations("constellation.news");
  const refFrise = useRef<HTMLDivElement>(null);
  const refEncre = useRef<SVGLineElement>(null);
  const [allumes, setAllumes] = useState<boolean[]>(() => articles.map(() => true));
  const [anime, setAnime] = useState(false);

  useEffect(() => {
    const frise = refFrise.current;
    if (!frise || mouvementReduit()) return;
    setAnime(true);
    let image = 0;

    function mesurer() {
      image = 0;
      if (!frise) return;
      const cadre = frise.getBoundingClientRect();
      const part = Math.min(1, Math.max(0, (window.innerHeight * 0.6 - cadre.top) / cadre.height));
      refEncre.current?.setAttribute("y2", String(part * frise.offsetHeight));
      const entrees = [...frise.querySelectorAll<HTMLElement>("[data-entree]")];
      const etats = entrees.map(
        (entree) => entree.getBoundingClientRect().top < window.innerHeight * 0.62,
      );
      setAllumes((avant) => (avant.every((v, i) => v === etats[i]) ? avant : etats));
    }
    function planifier() {
      if (!image) image = requestAnimationFrame(mesurer);
    }
    mesurer();
    window.addEventListener("scroll", planifier, { passive: true });
    window.addEventListener("resize", planifier);
    return () => {
      cancelAnimationFrame(image);
      window.removeEventListener("scroll", planifier);
      window.removeEventListener("resize", planifier);
    };
  }, [articles.length]);

  const formatDate = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Africa/Dakar",
  });

  return (
    <div ref={refFrise} className="frise" data-animee={anime ? "" : undefined}>
      <svg aria-hidden className="frise__trait" preserveAspectRatio="none">
        <defs>
          <linearGradient id="frise-degrade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2f8a3e" />
            <stop offset=".5" stopColor="#e8b931" />
            <stop offset="1" stopColor="#d64541" />
          </linearGradient>
        </defs>
        <line className="frise__piste" x1="3" y1="0" x2="3" y2="100%" />
        <line
          ref={refEncre}
          className="frise__encre"
          x1="3"
          y1="0"
          x2="3"
          y2={anime ? "0" : "100%"}
        />
      </svg>

      <ol>
        {articles.map((article, rang) => {
          const date = new Date(article.date);
          const [jour, mois, annee] = formatDate.format(date).split("/");
          return (
            <li
              key={article.id}
              data-entree
              data-allume={!anime || allumes[rang] ? "" : undefined}
              className="frise__entree"
            >
              <span aria-hidden className="frise__point" />
              <article className="frise__carte">
                <div className="frise__visuel">
                  {article.couverture ? (
                    <Image
                      src={article.couverture}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 460px, 100vw"
                      unoptimized
                      priority={prioritaire && rang === 0}
                      className="object-cover"
                    />
                  ) : (
                    <NewsCanvas id={article.id} />
                  )}
                  <b className="frise__etiquette police-grotesk">{article.etiquette}</b>
                </div>
                <div className="frise__texte">
                  <time dateTime={article.date} className="police-grotesk frise__date">
                    {jour} · {mois} · {annee}
                  </time>
                  <Titre className="frise__titre">{article.titre}</Titre>
                  <Link href={article.href} className="frise__lire">
                    {t("read")}
                    <ArrowRight aria-hidden size={16} />
                    <span className="sr-only"> — {article.titre}</span>
                  </Link>
                </div>
              </article>
              <span aria-hidden className="frise__quand police-grotesk">
                {jour}.{mois}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
