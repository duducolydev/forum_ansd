import Link from "next/link";
import type { ReactNode } from "react";
import type { PageSection } from "@prisma/client";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  Globe2,
  Handshake,
  Mail,
  MapPin,
  Mic,
  Newspaper,
  Users,
  type LucideIcon,
} from "lucide-react";
import { CompteurAnime } from "@/components/motion/CompteurAnime";
import { Eyebrow, Reveal as RevealMotion } from "@/components/motion/Reveal";
import { SplitTitle } from "@/components/motion/SplitTitle";
import { ReseauHero } from "@/components/home/ReseauHero";
import { MiniCountdown } from "@/components/home/MiniCountdown";
import { AnimatedLogo } from "@/components/home/AnimatedLogo";
import { TeteSection } from "@/components/home/TeteSection";
import { Piliers } from "@/components/home/Piliers";
import { NewsTimeline } from "@/components/home/NewsTimeline";
import { PartnersMarquee } from "@/components/home/PartnersMarquee";
import { ScrubText } from "@/components/motion/ScrubText";
import { ScrambleText } from "@/components/motion/ScrambleText";
import { motsDeTexteRiche } from "@/lib/mots-texte-riche";
import { plageDeDates } from "@/lib/dates-edition";
import { Reveal } from "@/components/site/reveal";
import { EnteteSection } from "@/components/site/entete-section";
import { TexteRiche } from "@/components/site/texte-riche";
import { urlVersionnee } from "@/lib/url-fichier";
import {
  classesBoutonSite,
  iconeDeLien,
  LienSite,
  LienSiteExterne,
} from "@/components/site/bouton-site";
import { LienNousEcrire } from "@/modules/contact/components/lien-nous-ecrire";
import { resolveLocaleValue } from "@/modules/content/service";
import type { BoutonSection } from "../catalogue";
import { lireBooleen, lireBoutons, lireContenu, lireNombre, lireTexte } from "../schema";
import { tonDuNiveau } from "@/modules/sponsors/palette";
import type { DonneesSections } from "../donnees";
import { IntervenantsFiltrables } from "./intervenants-filtrables";

/**
 * Rendu d'une section (§8.4, habillage §10).
 *
 * Chaque type a sa présentation écrite ici, en dur : c'est ce qui permet de la
 * tester, de la garder accessible et de la garantir lisible sur téléphone. Les
 * réglages décident du contenu et de l'agencement proposé, jamais du CSS.
 *
 * Les animations passent toutes par `Reveal` et par `--duree-animation`, donc
 * se coupent sous `prefers-reduced-motion`. Les couleurs reprennent des jetons
 * déjà vérifiés en contraste ; les dégradés décoratifs ne portent aucun texte.
 */

interface Props {
  section: PageSection;
  donnees: DonneesSections;
  locale: "fr" | "en";
}

/** Texte d'un champ, dans la langue du visiteur, avec repli sur le français. */
function texte(section: PageSection, cle: string, locale: "fr" | "en"): string {
  const fr = lireContenu(section.contentFr)[cle] ?? "";
  const en = lireContenu(section.contentEn)[cle] ?? "";
  return resolveLocaleValue(fr, en, locale);
}

function lireReglage(section: PageSection, cle: string): unknown {
  return (section.settings as Record<string, unknown> | null)?.[cle];
}

/**
 * Fond d'une section de texte.
 *
 * « Sombre » fait passer la section **entière** dans le thème sombre du site :
 * titres, textes, liens et boutons y prennent les couleurs de ce thème, déjà
 * mesurées, et le fond prend `--fond-sombre`, plus foncé que le fond adouci.
 * Poser des couleurs claires une à une aurait laissé passer un lien ou un bouton
 * resté dans les tons du thème clair — illisible sur fond foncé.
 */
/**
 * Couleur de fond d'une section, telle que la page l'affiche. Sert à poser un
 * séparateur ondulé (`WaveDivider`) entre deux sections de fonds différents :
 * les filets de séparation ont disparu avec le système « Constellation ».
 */
export function fondDeSection(section: Pick<PageSection, "type" | "variant">): string {
  switch (section.type) {
    case "texte":
    case "appel":
    case "piliers":
      if (section.variant === "sombre") return "var(--fond-sombre)";
      return section.variant === "adouci" ? "var(--bg-2)" : "var(--bg)";
    case "chiffres":
    case "programme":
      return "var(--bg-2)";
    case "actualites":
      return section.variant === "frise" ? "var(--bg-2)" : "var(--bg)";
    case "sponsors":
      return section.variant === "carrousel" ? "var(--bg)" : "var(--bg-2)";
    default:
      return "var(--bg)";
  }
}

function fondDe(variant: string): { className: string; theme?: "dark" } {
  if (variant === "sombre") {
    return { className: "bg-fond-sombre", theme: "dark" };
  }
  return {
    className: variant === "adouci" ? "bg-bg-2" : "",
  };
}

function Boutons({
  boutons,
  locale,
  children,
}: {
  boutons: BoutonSection[];
  locale: "fr" | "en";
  /** Boutons tenus par le code, placés après ceux de la section. */
  children?: ReactNode;
}) {
  if (boutons.length === 0 && !children) return null;

  return (
    <div className="flex flex-wrap gap-2.5">
      {boutons.map((bouton) => {
        const libelle = resolveLocaleValue(bouton.labelFr, bouton.labelEn, locale);
        const Icone = iconeDeLien(bouton.href) ?? undefined;
        const ton = bouton.style === "principal" ? "principal" : "secondaire";

        // Une adresse externe s'ouvre dans un onglet neuf ; une adresse interne
        // reste dans la navigation client de Next.
        return bouton.href.startsWith("http") ? (
          <LienSiteExterne
            key={bouton.href}
            href={bouton.href}
            target="_blank"
            ton={ton}
            icone={Icone}
          >
            {libelle}
          </LienSiteExterne>
        ) : (
          <LienSite key={bouton.href} href={bouton.href} ton={ton} icone={Icone}>
            {libelle}
          </LienSite>
        );
      })}
      {children}
    </div>
  );
}

/** Lien « voir tout », en haut à droite d'une section de liste. */
function LienTout({ href, libelle }: { href: string; libelle: string }) {
  return (
    <LienSite href={href} taille="compact" iconeApres={ArrowRight}>
      {libelle}
    </LienSite>
  );
}

const CADRE = "mx-auto max-w-[1200px] px-6";

type Partenaire = NonNullable<DonneesSections["sponsors"]>[number];

export function RenduSection({ section, donnees, locale }: Props) {
  const { edition } = donnees;
  const en = locale === "en";

  /*
   * Ancre de la section, quand elle en porte une.
   *
   * `scroll-mt-24` compte autant que l'`id` : l'en-tête du site est collant, et
   * sans marge de défilement le titre visé se retrouve caché dessous. Un lien
   * qui amène « presque » au bon endroit passe pour un lien cassé.
   */
  const ancre = lireTexte(section.settings, "ancre") || undefined;
  // 96 px sous la barre de 80 px, 136 px sous celle de 104 px du grand écran.
  const classeAncre = ancre ? " scroll-mt-24 lg:scroll-mt-34" : "";

  /*
   * Illustration déposée en BackOffice, servie par une route contrôlée.
   *
   * Elle n'est **jamais** placée derrière du texte à pleine opacité : c'est le
   * plus sûr moyen de casser un contraste vérifié. Dans le bandeau elle reste
   * un fond décoratif, cantonné à une moitié et estompé ; ailleurs c'est une
   * image à part entière, avec son texte alternatif.
   *
   * Sa position (à gauche ou à droite) ne change que la **disposition** : dans
   * la page, le texte vient toujours en premier, ce qui garde le même ordre de
   * lecture à la synthèse vocale et sur téléphone, où l'image passe dessous.
   */
  const cheminImage = lireTexte(section.settings, "image");
  const illustration = cheminImage
    ? urlVersionnee(`/api/v1/sections/${section.id}/image`, cheminImage)
    : null;
  const illustrationAlt = texte(section, "imageAlt", locale);
  const imageAGauche = lireTexte(section.settings, "positionImage") === "gauche";

  switch (section.type) {
    case "hero": {
      const accroche = texte(section, "titre", locale);
      const avecLogo = section.variant === "avec-compteur";
      // Logo officiel sauf choix explicite du logo animé : c'est le défaut
      // demandé le 29 septembre 2026, y compris pour la composition d'origine.
      const logo = lireTexte(section.settings, "logo") === "anime" ? "animated" : "official";
      const ouverture = donnees.ouverture ?? edition.startDate;
      // Nom du Forum dans la langue de la page, et dans l'autre en dessous.
      const titrePrincipal = en ? edition.titleEn || edition.title : edition.title;
      // Sans titre anglais saisi, pas de second titre (il répéterait le premier).
      const titreSecond = edition.titleEn ? (en ? edition.title : edition.titleEn) : null;

      /*
       * Bandeau « Constellation » (brief §4.1) : deux colonnes, texte à gauche
       * et grand logo animé à droite ; une seule colonne sous 1 024 px, le
       * logo passant sous le texte.
       *
       * L'illustration éventuelle reste un décor estompé sur une moitié du
       * bandeau, du côté opposé au texte. Aucun texte ne repose dessus.
       */
      const decorAGauche = Boolean(illustration) && imageAGauche;

      return (
        <section id={ancre} className={`bandeau-accueil fond-bandeau${classeAncre}`}>
          {illustration && (
            <span
              aria-hidden
              className={`pointer-events-none absolute inset-y-0 -z-10 hidden w-1/2 lg:block ${
                decorAGauche ? "left-0" : "right-0"
              }`}
              style={{
                backgroundImage: `url(${illustration})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                opacity: 0.16,
                maskImage: `linear-gradient(to ${decorAGauche ? "left" : "right"}, transparent, black 45%)`,
                WebkitMaskImage: `linear-gradient(to ${decorAGauche ? "left" : "right"}, transparent, black 45%)`,
              }}
            />
          )}

          {/* Décor : réseau de données (canvas différé) et taches floues. */}
          <ReseauHero />
          <span aria-hidden className="tache tache--1" />
          <span aria-hidden className="tache tache--2" />
          <span aria-hidden className="tache tache--3" />

          {/* Titre sur toute la largeur de la section (et non du cadre de 1 200 px). */}
          <div className="relative w-full px-6 pt-10">
            {/*
             * Compte à rebours réduit, dans le coin supérieur droit (demande du
             * 29 septembre 2026). Sur téléphone, il passe au-dessus du titre.
             */}
            {avecLogo && (
              <RevealMotion
                variant="right"
                delay={0.1}
                className="mb-6 flex justify-end lg:absolute lg:top-6 lg:right-8 lg:mb-0"
              >
                <MiniCountdown
                  petit
                  cibleIso={ouverture.toISOString()}
                  finIso={edition.endDate.toISOString()}
                />
              </RevealMotion>
            )}

            {/*
             * Nom du Forum sur toute la largeur, centré (demande du 29 septembre
             * 2026), avec son nom dans l'autre langue en dessous. Le premier
             * porte le `h1` ; l'accroche plus bas est un `h2`.
             */}
            <div className="titre-accueil-bloc">
              <SplitTitle texte={titrePrincipal} className="titre-accueil uppercase" />
              {titreSecond && (
                <RevealMotion variant="up" delay={0.8}>
                  <p lang={en ? "fr" : "en"} className="titre-accueil-second police-grotesk">
                    {titreSecond}
                  </p>
                </RevealMotion>
              )}
            </div>
          </div>

          <div className={`${CADRE} relative w-full pb-24`}>
            <div
              className={`mt-10 grid items-center gap-12 ${
                avecLogo ? "lg:grid-cols-[1.2fr_0.95fr]" : ""
              }`}
            >
              <div className={avecLogo && decorAGauche ? "lg:order-last" : undefined}>
                <RevealMotion variant="up" delay={0.9} className="mb-6">
                  <span className="pastille-conique text-sm sm:text-base">
                    <span className="inline-flex items-center gap-2">
                      <CalendarDays aria-hidden size={17} className="text-[var(--green-text)]" />
                      {plageDeDates(edition.startDate, edition.endDate, en)}
                    </span>
                    <span aria-hidden className="hidden h-[18px] w-px bg-[var(--line)] sm:block" />
                    <span className="inline-flex items-center gap-2">
                      <MapPin aria-hidden size={17} className="text-[var(--green-text)]" />
                      {edition.venue}
                    </span>
                  </span>
                </RevealMotion>

                {accroche && accroche !== edition.title && (
                  <RevealMotion variant="blur" delay={1.1}>
                    <h2 className="slogan-degrade max-w-[22ch] text-balance">{accroche}</h2>
                  </RevealMotion>
                )}

                <RevealMotion variant="up" delay={1.3}>
                  <TexteRiche
                    valeur={texte(section, "chapo", locale) || edition.theme || ""}
                    className="mt-4 mb-8 max-w-[560px] text-[1.12rem] leading-[1.7] text-[var(--muted)]"
                  />
                </RevealMotion>

                <RevealMotion variant="up" delay={1.5}>
                  <Boutons boutons={lireBoutons(lireReglage(section, "boutons"))} locale={locale}>
                    {/* Formulaire de contact en fenêtre (demande du 29 septembre 2026). */}
                    <LienNousEcrire data-magnetic className={classesBoutonSite("secondaire")}>
                      <Mail aria-hidden size={17} strokeWidth={2.2} />
                      {en ? "Write to us" : "Nous écrire"}
                    </LienNousEcrire>
                  </Boutons>
                </RevealMotion>
              </div>

              {avecLogo && <AnimatedLogo variant={logo} />}
            </div>
          </div>

          <span aria-hidden className="molette hidden lg:block" />
        </section>
      );
    }

    case "texte": {
      const corps = texte(section, "corps", locale);
      if (!corps) return null;
      const titre = texte(section, "titre", locale);
      const etiquette = texte(section, "etiquette", locale);
      const fond = fondDe(section.variant);

      /*
       * Texte qui s'allume mot à mot (brief §4.2) : étiquette, titre révélé,
       * puis `ScrubText`. Les mots clés sont ceux que l'éditeur a mis en gras
       * ou en italique.
       */
      if (lireBooleen(section.settings, "defilement", false)) {
        return (
          <section
            id={ancre}
            data-theme={fond.theme}
            className={`${fond.className} section-constellation${classeAncre}`}
          >
            <div className={CADRE}>
              {etiquette && (
                <RevealMotion variant="left">
                  <Eyebrow>{etiquette}</Eyebrow>
                </RevealMotion>
              )}
              {titre && (
                <RevealMotion variant="up">
                  <h2 className="titre-section">{titre}</h2>
                </RevealMotion>
              )}
              <ScrubText paragraphes={motsDeTexteRiche(corps)} />
            </div>
          </section>
        );
      }

      return (
        <section
          id={ancre}
          data-theme={fond.theme}
          className={`${fond.className} py-16${classeAncre}`}
        >
          <div className={CADRE}>
            <Reveal>
              {titre && <EnteteSection titre={titre} />}
              <div
                className={
                  illustration
                    ? `grid grid-cols-1 items-start gap-10 ${
                        imageAGauche
                          ? "md:grid-cols-[0.85fr_1.15fr]"
                          : "md:grid-cols-[1.15fr_0.85fr]"
                      }`
                    : ""
                }
              >
                <TexteRiche
                  valeur={corps}
                  className="text-text-2 max-w-[80ch] text-lg leading-relaxed"
                />
                {illustration && (
                  /* eslint-disable-next-line @next/next/no-img-element -- servie par une route contrôlée, hors optimiseur */
                  <img
                    src={illustration}
                    alt={illustrationAlt}
                    /*
                     * Le cadre épouse l'image plutôt que de l'encadrer à
                     * largeur fixe. Avec `w-full` et un fond, une photographie
                     * se retrouvait bordée de bandes blanches — le défaut ne se
                     * voit qu'avec une vraie photo, pas avec un pictogramme.
                     */
                    className={`border-border mx-auto max-h-72 rounded-2xl border object-contain shadow-sm ${
                      imageAGauche ? "md:order-first" : ""
                    }`}
                  />
                )}
              </div>
            </Reveal>
          </div>
        </section>
      );
    }

    case "piliers": {
      const piliers = [1, 2, 3]
        .map((rang) => ({
          titre: texte(section, `pilier${rang}Titre`, locale),
          texte: texte(section, `pilier${rang}Texte`, locale),
        }))
        .filter((pilier) => pilier.titre);
      if (piliers.length === 0) return null;
      const fond = fondDe(section.variant);

      return (
        <section
          id={ancre}
          data-theme={fond.theme}
          className={`${fond.className} pb-20${classeAncre}`}
        >
          <div className={CADRE}>
            <Piliers piliers={piliers} />
          </div>
        </section>
      );
    }

    case "chiffres": {
      const stats = donnees.stats;
      if (!stats) return null;
      const jours =
        Math.round(
          (edition.endDate.getTime() - edition.startDate.getTime()) / (24 * 60 * 60 * 1000),
        ) + 1;

      const chiffres = [
        lireBooleen(section.settings, "participants", true) && {
          valeur: stats.confirmedParticipants,
          label: en ? "Confirmed participants" : "Participants confirmés",
          icone: Users,
          ton: "bg-blue-soft text-blue-text",
        },
        lireBooleen(section.settings, "pays", true) && {
          valeur: stats.countryCount,
          label: en ? "Countries" : "Pays représentés",
          icone: Globe2,
          ton: "bg-accent-soft text-accent-text",
        },
        lireBooleen(section.settings, "sessions", true) && {
          valeur: stats.publishedSessions,
          label: en ? "Published sessions" : "Sessions publiées",
          icone: CalendarDays,
          ton: "bg-gold-soft text-gold-text",
        },
        lireBooleen(section.settings, "intervenants", true) && {
          valeur: stats.publishedSpeakers,
          label: en ? "Speakers" : "Intervenants",
          icone: Mic,
          ton: "bg-blue-soft text-blue-text",
        },
        lireBooleen(section.settings, "jours", false) && {
          valeur: jours,
          label: en ? "Days" : "Journées",
          icone: Clock,
          ton: "bg-accent-soft text-accent-text",
        },
      ].filter(Boolean) as {
        valeur: number;
        label: string;
        icone: LucideIcon;
        ton: string;
      }[];

      if (chiffres.length === 0) return null;
      const titre = texte(section, "titre", locale);

      return (
        <section id={ancre} className={`bg-bg-2 py-16${classeAncre}`}>
          <div className={CADRE}>
            {titre && (
              <Reveal>
                <EnteteSection surtitre={en ? "In figures" : "En chiffres"} titre={titre} />
              </Reveal>
            )}
            <div
              className={
                section.variant === "bandeau"
                  ? "flex flex-wrap justify-between gap-6"
                  : "grid grid-cols-2 gap-4 md:grid-cols-4"
              }
            >
              {chiffres.map((chiffre, rang) => {
                const Icone = chiffre.icone;
                return (
                  <Reveal key={chiffre.label} delai={rang * 70}>
                    <div
                      className={
                        section.variant === "bandeau"
                          ? "flex min-w-[150px] items-center gap-3"
                          : "border-border bg-surface carte-relief filet-haut relative h-full overflow-hidden rounded-xl border p-5.5"
                      }
                    >
                      <span
                        className={`mb-3 grid h-10 w-10 place-items-center rounded-xl ${chiffre.ton}`}
                      >
                        <Icone aria-hidden size={19} strokeWidth={2.2} />
                      </span>
                      <span className="block">
                        <b className="num font-display text-heading block text-[2.4rem] leading-none font-extrabold">
                          <CompteurAnime valeur={chiffre.valeur} />
                        </b>
                        <span className="text-text-3 mt-1.5 block text-sm">{chiffre.label}</span>
                      </span>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>
      );
    }

    case "actualites": {
      const articles = (donnees.actualites ?? []).slice(
        0,
        lireNombre(section.settings, "nombre", 3),
      );
      if (articles.length === 0) return null;
      const enListe = section.variant === "liste";

      if (section.variant === "frise") {
        return (
          <section
            id={ancre}
            className={`section-constellation section-constellation--alt${classeAncre}`}
          >
            <div className={CADRE}>
              <TeteSection
                etiquette={<ScrambleText texte={en ? "FOLLOW THE FORUM" : "SUIVRE LE FORUM"} />}
                titre={texte(section, "titre", locale) || (en ? "News" : "Actualités")}
                icone={Newspaper}
                lien={{ href: "/actualites", libelle: en ? "All news" : "Toutes les actualités" }}
              />
              <NewsTimeline
                locale={locale}
                articles={articles.map((article) => ({
                  id: article.id,
                  href: `/actualites/${article.slug}`,
                  titre: en ? article.titleEn || article.titleFr : article.titleFr,
                  date: (article.publishedAt ?? article.createdAt).toISOString(),
                  couverture: article.coverPath
                    ? `/api/v1/posts/${article.id}/image/couverture`
                    : null,
                  etiquette: en ? "NEWS" : "ACTUALITÉ",
                }))}
              />
            </div>
          </section>
        );
      }

      return (
        <section id={ancre} className={`py-16${classeAncre}`}>
          <div className={CADRE}>
            <Reveal>
              <EnteteSection
                surtitre={en ? "Keep up" : "Suivre le Forum"}
                titre={texte(section, "titre", locale) || (en ? "News" : "Actualités")}
                icone={Newspaper}
                action={
                  <LienTout
                    href="/actualites"
                    libelle={en ? "All news" : "Toutes les actualités"}
                  />
                }
              />
            </Reveal>

            <div
              className={enListe ? "flex flex-col gap-3" : "grid grid-cols-1 gap-5 md:grid-cols-3"}
            >
              {articles.map((article, rang) => (
                <Reveal key={article.id} delai={rang * 80} className="h-full">
                  <Link
                    href={`/actualites/${article.slug}`}
                    className="border-border bg-surface carte-lien h-full rounded-xl border"
                  >
                    {!enListe && (
                      /*
                       * Le cadre média existe même sans couverture : sans lui,
                       * une grille mélangeant articles illustrés et non illustrés
                       * décalait les titres d'une carte à l'autre.
                       */
                      <span className="bg-bg-2 border-border block border-b">
                        {article.coverPath ? (
                          /* eslint-disable-next-line @next/next/no-img-element -- servie par une route contrôlée, hors optimiseur */
                          <img
                            src={`/api/v1/posts/${article.id}/image/couverture`}
                            alt=""
                            className="vignette"
                          />
                        ) : (
                          <span className="vignette from-bg-2 to-bg-3 grid place-items-center bg-gradient-to-br">
                            <Newspaper aria-hidden size={30} className="text-text-3 opacity-45" />
                          </span>
                        )}
                      </span>
                    )}
                    <span className="flex flex-1 flex-col p-5.5">
                      <span className="text-text-3 flex items-center gap-1.5 text-sm">
                        <Clock aria-hidden size={13} />
                        {article.publishedAt
                          ? new Intl.DateTimeFormat(locale).format(article.publishedAt)
                          : ""}
                      </span>
                      <span className="titre-carte text-heading font-display mt-2 block text-lg leading-snug font-semibold">
                        {en ? article.titleEn : article.titleFr}
                      </span>
                      <span className="text-link mt-auto flex items-center gap-1.5 pt-4 text-sm font-semibold">
                        {en ? "Read" : "Lire"}
                        <ArrowRight aria-hidden size={14} />
                      </span>
                    </span>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      );
    }

    case "programme": {
      const sessions = (donnees.sessions ?? []).slice(0, lireNombre(section.settings, "nombre", 6));
      if (sessions.length === 0) return null;

      const parJour = new Map<string, typeof sessions>();
      for (const seance of sessions) {
        const jour = seance.startTime.toISOString().slice(0, 10);
        parJour.set(jour, [...(parJour.get(jour) ?? []), seance]);
      }
      const formatJour = new Intl.DateTimeFormat(en ? "en-GB" : "fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "Africa/Dakar",
      });
      const formatHeure = new Intl.DateTimeFormat(en ? "en-GB" : "fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Africa/Dakar",
      });

      return (
        <section id={ancre} className={`bg-bg-2 py-16${classeAncre}`}>
          <div className={CADRE}>
            <Reveal>
              <EnteteSection
                surtitre={en ? "Three days" : "Trois journées"}
                titre={texte(section, "titre", locale) || "Programme"}
                icone={CalendarDays}
                action={
                  <LienTout
                    href="/programme"
                    libelle={en ? "Full programme" : "Tout le programme"}
                  />
                }
              />
            </Reveal>

            <div className="flex flex-col gap-7">
              {[...parJour.entries()].map(([jour, seances], rangJour) => (
                <Reveal key={jour} delai={rangJour * 90}>
                  <h3 className="surtitre mb-3">
                    {formatJour.format(new Date(`${jour}T12:00:00.000Z`))}
                  </h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {seances.map((seance) => (
                      <Link
                        key={seance.id}
                        href={`/programme/${seance.slug}`}
                        className="border-border bg-surface carte-lien flex-row items-center gap-4 rounded-xl border p-4"
                      >
                        <span className="bg-blue-soft text-blue-text grid h-12 w-14 shrink-0 place-items-center rounded-lg text-sm font-bold tabular-nums">
                          {formatHeure.format(seance.startTime)}
                        </span>
                        <span className="titre-carte text-heading text-sm leading-snug font-semibold">
                          {en ? seance.titleEn : seance.titleFr}
                        </span>
                      </Link>
                    ))}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      );
    }

    case "intervenants": {
      const intervenants = donnees.intervenants ?? [];
      if (intervenants.length === 0) return null;

      return (
        <section id={ancre} className={`section-constellation${classeAncre}`}>
          <div className={CADRE}>
            <TeteSection
              etiquette={en ? "They speak" : "Ils interviennent"}
              titre={texte(section, "titre", locale) || (en ? "Speakers" : "Intervenants")}
              icone={Mic}
              lien={{ href: "/intervenants", libelle: en ? "See all" : "Voir tout" }}
            />

            {/* Filtre par thème et cartes retournables : `intervenants-filtrables.tsx`. */}
            <IntervenantsFiltrables
              intervenants={intervenants}
              nombre={lireNombre(section.settings, "nombre", 8)}
              en={en}
            />
          </div>
        </section>
      );
    }

    case "sponsors": {
      const sponsors = donnees.sponsors ?? [];
      if (sponsors.length === 0) return null;

      const entete = (
        <Reveal>
          <EnteteSection
            surtitre={en ? "With the support of" : "Avec le soutien de"}
            titre={texte(section, "titre", locale) || (en ? "Partners" : "Partenaires")}
            icone={Handshake}
            action={<LienTout href="/sponsors" libelle={en ? "See all" : "Voir tout"} />}
          />
        </Reveal>
      );

      if (section.variant === "carrousel") {
        /*
         * Double bandeau « Constellation » (brief §4.5), sur toute la largeur.
         * Sans libellé de niveau : seule la couleur du niveau reste, en liseré
         * (arbitrage du 28 septembre 2026).
         */
        return (
          <section id={ancre} className={`section-constellation${classeAncre}`}>
            <div className={CADRE}>
              <TeteSection
                etiquette={en ? "With the support of" : "Avec le soutien de"}
                titre={texte(section, "titre", locale) || (en ? "Partners" : "Partenaires")}
                icone={Handshake}
                lien={{ href: "/sponsors", libelle: en ? "See all" : "Voir tout" }}
              />
            </div>
            <RevealMotion variant="blur">
              <PartnersMarquee
                libelle={en ? "Partners" : "Partenaires"}
                partenaires={sponsors.map((sponsor) => ({
                  id: sponsor.id,
                  nom: sponsor.name,
                  logo: sponsor.logoPath
                    ? urlVersionnee(`/api/v1/sponsors/${sponsor.id}/logo`, sponsor.logoPath)
                    : null,
                  site: sponsor.website,
                  filet: tonDuNiveau(sponsor.level).filet,
                }))}
              />
            </RevealMotion>
          </section>
        );
      }

      /*
       * Grille et bandeau : groupés par niveau, dans l'ordre des niveaux ; à
       * l'intérieur d'un niveau, l'ordre du comité est conservé.
       */
      const parNiveau = new Map<string, Partenaire["level"] & { sponsors: Partenaire[] }>();
      for (const sponsor of sponsors) {
        const groupe = parNiveau.get(sponsor.level.id) ?? { ...sponsor.level, sponsors: [] };
        groupe.sponsors.push(sponsor);
        parNiveau.set(sponsor.level.id, groupe);
      }
      const niveaux = [...parNiveau.values()].sort((a, b) => a.sortOrder - b.sortOrder);

      return (
        <section id={ancre} className={`bg-bg-2 py-16${classeAncre}`}>
          <div className={CADRE}>
            {entete}

            {niveaux.map((niveau, rangNiveau) => (
              <Reveal key={niveau.id} delai={rangNiveau * 80}>
                <div className="mb-7">
                  {/* Le nom du niveau n'est plus affiché : un filet à sa couleur sépare les groupes. */}
                  <span
                    aria-hidden
                    className={`mb-3 block h-1 w-16 rounded-full bg-gradient-to-r ${tonDuNiveau(niveau).filet}`}
                  />
                  <div
                    className={
                      section.variant === "bandeau"
                        ? "flex flex-wrap items-center gap-6"
                        : "grid grid-cols-2 gap-3 sm:grid-cols-4"
                    }
                  >
                    {niveau.sponsors.map((sponsor) => {
                      const contenu = sponsor.logoPath ? (
                        /* eslint-disable-next-line @next/next/no-img-element -- servie par une route contrôlée, hors optimiseur */
                        <img
                          src={urlVersionnee(
                            `/api/v1/sponsors/${sponsor.id}/logo`,
                            sponsor.logoPath,
                          )}
                          alt={sponsor.name}
                          style={
                            niveau.logoMaxWidth
                              ? { maxWidth: `${niveau.logoMaxWidth}px` }
                              : undefined
                          }
                          className="max-h-14 object-contain"
                        />
                      ) : (
                        <span className="font-display text-blue-text font-semibold">
                          {sponsor.name}
                        </span>
                      );
                      const classes =
                        section.variant === "bandeau"
                          ? "grid h-16 place-items-center px-3"
                          : "border-border bg-surface carte-relief grid h-22 place-items-center rounded-xl border px-3 text-center";

                      return sponsor.website ? (
                        <a
                          key={sponsor.id}
                          href={sponsor.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${classes} hover:border-link`}
                        >
                          {contenu}
                        </a>
                      ) : (
                        <div key={sponsor.id} className={classes}>
                          {contenu}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      );
    }

    case "appel": {
      const titre = texte(section, "titre", locale);
      const corps = texte(section, "corps", locale);
      if (!titre && !corps) return null;
      const fond = fondDe(section.variant);

      return (
        <section
          id={ancre}
          data-theme={fond.theme}
          className={`${fond.className} py-16${classeAncre}`}
        >
          <div className={CADRE}>
            <Reveal>
              <div className="border-dark-panel-line bg-dark-panel text-dark-panel-text relative overflow-hidden rounded-2xl border px-8 py-12 shadow-[var(--shadow)]">
                <span
                  aria-hidden
                  className="from-ansd-bleu-vif to-ansd-vert-vif absolute inset-x-0 top-0 h-1 bg-gradient-to-r"
                />
                {/*
                 * Avec une illustration, le panneau s'organise en deux colonnes
                 * sur grand écran — l'image du côté choisi, le texte aligné de
                 * son côté. Sans illustration, il reste centré.
                 */}
                <div
                  className={
                    illustration
                      ? `grid grid-cols-1 items-center gap-8 ${
                          imageAGauche ? "md:grid-cols-[auto_1fr]" : "md:grid-cols-[1fr_auto]"
                        }`
                      : "text-center"
                  }
                >
                  <div className={illustration ? "text-center md:text-start" : undefined}>
                    {titre && <h2 className="font-display mb-3 text-white">{titre}</h2>}
                    {corps && (
                      <TexteRiche
                        valeur={corps}
                        classeLien="text-white font-semibold underline underline-offset-2"
                        className={`text-dark-panel-muted mb-7 max-w-[60ch] text-lg ${
                          illustration ? "mx-auto md:mx-0" : "mx-auto"
                        }`}
                      />
                    )}
                    <div
                      className={`flex ${illustration ? "justify-center md:justify-start" : "justify-center"}`}
                    >
                      <Boutons
                        boutons={lireBoutons(lireReglage(section, "boutons"))}
                        locale={locale}
                      />
                    </div>
                  </div>
                  {illustration && (
                    /* eslint-disable-next-line @next/next/no-img-element -- servie par une route contrôlée, hors optimiseur */
                    <img
                      src={illustration}
                      alt={illustrationAlt}
                      className={`mx-auto max-h-40 rounded-xl bg-white/5 object-contain p-2 md:max-w-[240px] ${
                        imageAGauche ? "md:order-first" : ""
                      }`}
                    />
                  )}
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      );
    }

    default:
      // Type inconnu : la section a été créée par une version plus récente du
      // catalogue. On n'affiche rien plutôt que de casser la page entière.
      return null;
  }
}
