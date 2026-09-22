import Link from "next/link";
import type { PageSection } from "@prisma/client";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  Globe2,
  MapPin,
  Mic,
  Newspaper,
  Radio,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Countdown } from "@/components/site/countdown";
import { Reveal } from "@/components/site/reveal";
import { EnteteSection } from "@/components/site/entete-section";
import { TexteRiche } from "@/components/site/texte-riche";
import { urlVersionnee } from "@/lib/url-fichier";
import { iconeDeLien, LienSite, LienSiteExterne } from "@/components/site/bouton-site";
import { resolveLocaleValue } from "@/modules/content/service";
import type { BoutonSection } from "../catalogue";
import { lireBooleen, lireBoutons, lireContenu, lireNombre, lireTexte } from "../schema";
import type { DonneesSections } from "../donnees";

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

/**
 * Statistiques de participation du bandeau d'accueil : masquées (demande du
 * commanditaire, 22 septembre 2026), le temps que les inscriptions démarrent.
 *
 * Un compteur qui annonce douze confirmés sur une page d'accueil publiée avant
 * l'ouverture dessert le Forum plus qu'il ne le sert. Le compte à rebours, lui,
 * reste : il dit la même chose sans chiffre à comparer.
 *
 * Un interrupteur plutôt qu'un bloc mis en commentaire : le code reste compilé,
 * relu par TypeScript et par ESLint, donc encore juste le jour où il faudra le
 * rallumer — repasser cette constante à `true` suffit, et rien d'autre n'est à
 * retrouver.
 */
const STATS_ACCUEIL_VISIBLES: boolean = false;

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
function fondDe(variant: string): { className: string; theme?: "dark" } {
  if (variant === "sombre") {
    return { className: "bg-fond-sombre border-border border-b", theme: "dark" };
  }
  return {
    className: variant === "adouci" ? "bg-bg-2 border-border border-b" : "border-border border-b",
  };
}

function Boutons({ boutons, locale }: { boutons: BoutonSection[]; locale: "fr" | "en" }) {
  if (boutons.length === 0) return null;

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
  const classeAncre = ancre ? " scroll-mt-24" : "";

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
      const dateFormatter = new Intl.DateTimeFormat(en ? "en-GB" : "fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Africa/Dakar",
      });
      const stats = donnees.stats;
      const accroche = texte(section, "titre", locale);
      const avecCompteur = section.variant === "avec-compteur" && stats;
      const maxPays = Math.max(1, ...(stats?.topCountries.map((row) => row.count) ?? [1]));

      /*
       * Illustration à gauche : le texte passe du côté opposé, pour qu'aucune
       * lettre ne repose sur le décor. Avec le compteur, c'est le panneau qui
       * vient à gauche, par-dessus l'illustration ; sans lui, le texte occupe
       * la moitié droite.
       */
      const decorAGauche = Boolean(illustration) && imageAGauche;

      return (
        <section id={ancre} className={`fond-bandeau border-border border-b${classeAncre}`}>
          {illustration && (
            /*
             * Décor, et rien d'autre : `aria-hidden`, cantonné à une moitié sur
             * grand écran, estompé vers le texte par un masque, et absent sur
             * téléphone où le texte occupe toute la largeur.
             */
            <span
              aria-hidden
              className={`pointer-events-none absolute inset-y-0 hidden w-1/2 lg:block ${
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
          {/*
           * Nom du Forum, en tête du bandeau et sur toute la largeur du cadre
           * (demande du commanditaire, 22 septembre 2026) — donc au-dessus du
           * repère de dates et de lieu, et hors de la grille : logé dans la
           * colonne de gauche, il tenait sur une demi-largeur et se cassait en
           * deux lignes à côté du compte à rebours.
           *
           * Il porte le `h1` de la page : l'accroche qui suit est un `h2`, pour
           * que la hiérarchie des titres reste celle que lisent les navigations
           * par titres. Les capitales sont celles du logo officiel, affiché
           * quelques centimètres plus haut — deux graphies du même nom sur le
           * même écran se remarquent.
           */}
          <Reveal className={`${CADRE} relative pt-14`}>
            <h1 className="titre-forum">{edition.title}</h1>
          </Reveal>

          <div
            className={`${CADRE} relative grid items-center gap-13 pt-8 pb-20 ${
              avecCompteur
                ? decorAGauche
                  ? "grid-cols-1 lg:grid-cols-[0.9fr_1.1fr]"
                  : "grid-cols-1 lg:grid-cols-[1.1fr_0.9fr]"
                : "grid-cols-1"
            }`}
          >
            <Reveal className={!avecCompteur && decorAGauche ? "lg:ms-auto lg:w-1/2" : undefined}>
              <span className="border-border bg-surface/70 text-heading mb-5 inline-flex items-center gap-2.5 rounded-full border px-4 py-1.5 text-sm font-semibold backdrop-blur">
                <CalendarDays aria-hidden size={15} className="text-accent-text" />
                {dateFormatter.format(edition.startDate)} – {dateFormatter.format(edition.endDate)}
                <span aria-hidden className="bg-border h-3.5 w-px" />
                <MapPin aria-hidden size={15} className="text-accent-text" />
                {edition.venue}
              </span>

              {/*
               * Titre et chapeau forment un seul bloc, de la largeur du chapeau
               * (PLAN.md §20). Le `ch` se mesure dans la police du texte courant
               * agrandi (`text-lg`), celle du chapeau : le titre, qui remplit le
               * bloc, s'aligne donc exactement sur ses deux bords. Il était
               * borné à 16 caractères de sa propre police et s'arrêtait à 427 px
               * pour un chapeau de 524.
               *
               * - Chapeau **justifié**, à la demande du commanditaire, et coupé
               *   selon la langue de la page (`hyphens-auto`) pour limiter les
               *   blancs entre les mots.
               * - Titre **centré** dans cette largeur, lignes équilibrées. Justifié,
               *   il s'affichait « Reliable⎵⎵⎵⎵⎵⎵data / for⎵⎵⎵⎵⎵⎵decisions » : deux ou
               *   trois mots par ligne ne laissent qu'un ou deux espaces à étirer,
               *   et aucune règle CSS ne plafonne cet étirement.
               */}
              <div className="max-w-[54ch] text-lg">
                {accroche && accroche !== edition.title && (
                  <h2 className="mb-5 text-center text-balance">{accroche}</h2>
                )}
                <TexteRiche
                  valeur={texte(section, "chapo", locale) || edition.theme || ""}
                  className="text-text-2 mb-8 text-justify leading-relaxed hyphens-auto"
                />
              </div>
              <Boutons boutons={lireBoutons(lireReglage(section, "boutons"))} locale={locale} />
            </Reveal>

            {avecCompteur && (
              <Reveal delai={120} className={decorAGauche ? "lg:order-first" : undefined}>
                <div className="border-dark-panel-line bg-dark-panel text-dark-panel-text relative overflow-hidden rounded-2xl border p-6 shadow-[var(--shadow)]">
                  <span
                    aria-hidden
                    className="from-ansd-bleu-vif to-ansd-vert-vif absolute inset-x-0 top-0 h-1 bg-gradient-to-r"
                  />

                  <div className="text-dark-panel-muted mb-4 flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
                    <Radio aria-hidden size={14} className="text-ansd-vert-vif" />
                    {en ? "Live countdown" : "Compte à rebours"}
                  </div>

                  <Countdown targetIso={edition.startDate.toISOString()} />

                  {STATS_ACCUEIL_VISIBLES && (
                    <>
                      <div className="border-dark-panel-line mt-5 flex items-end gap-3 border-t pt-4">
                        <Users aria-hidden size={20} className="text-ansd-vert-vif mb-1 shrink-0" />
                        <b className="num font-display text-[2.1rem] leading-none font-extrabold">
                          {stats.confirmedParticipants}
                        </b>
                        <span className="text-dark-panel-muted pb-1 text-sm">
                          {en ? "confirmed" : "confirmés"}
                          <span aria-hidden className="mx-1.5">
                            ·
                          </span>
                          <Globe2 aria-hidden size={13} className="mb-0.5 inline" />{" "}
                          {stats.countryCount} {en ? "countries" : "pays"}
                        </span>
                      </div>

                      {stats.topCountries.length > 0 && (
                        <div className="mt-4 flex flex-col gap-2">
                          {stats.topCountries.map((row) => (
                            <div
                              key={row.country}
                              className="text-dark-panel-muted flex items-center gap-2.5 text-xs"
                            >
                              <span className="w-20 shrink-0 truncate">{row.country}</span>
                              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                                <span
                                  className="from-ansd-vert-vif to-ansd-bleu-vif block h-full rounded-full bg-gradient-to-r"
                                  style={{ width: `${Math.max(6, (row.count / maxPays) * 100)}%` }}
                                />
                              </span>
                              <span className="w-6 text-right tabular-nums">{row.count}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </Reveal>
            )}
          </div>
        </section>
      );
    }

    case "texte": {
      const corps = texte(section, "corps", locale);
      if (!corps) return null;
      const titre = texte(section, "titre", locale);
      const fond = fondDe(section.variant);

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
        <section id={ancre} className={`border-border bg-bg-2 border-b py-16${classeAncre}`}>
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
                          {chiffre.valeur}
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

      return (
        <section id={ancre} className={`border-border border-b py-16${classeAncre}`}>
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
        <section id={ancre} className={`border-border bg-bg-2 border-b py-16${classeAncre}`}>
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
      const speakers = (donnees.intervenants ?? []).slice(
        0,
        lireNombre(section.settings, "nombre", 8),
      );
      if (speakers.length === 0) return null;

      return (
        <section id={ancre} className={`border-border border-b py-16${classeAncre}`}>
          <div className={CADRE}>
            <Reveal>
              <EnteteSection
                surtitre={en ? "They speak" : "Ils interviennent"}
                titre={texte(section, "titre", locale) || (en ? "Speakers" : "Intervenants")}
                icone={Mic}
                action={
                  <LienTout
                    href="/intervenants"
                    libelle={en ? "All speakers" : "Tous les intervenants"}
                  />
                }
              />
            </Reveal>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {speakers.map((speaker, rang) => (
                <Reveal key={speaker.id} delai={rang * 60} className="h-full">
                  <div className="border-border bg-surface carte-relief h-full rounded-xl border p-5 text-center">
                    {speaker.photoPath ? (
                      /* eslint-disable-next-line @next/next/no-img-element -- servie par une route contrôlée, hors optimiseur */
                      <img
                        src={`/api/v1/speakers/${speaker.id}/photo`}
                        alt=""
                        className="ring-border bg-bg-2 mx-auto mb-3 h-22 w-22 rounded-full object-cover ring-2 ring-offset-2 ring-offset-[var(--surface)]"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="from-ansd-bleu-vif to-ansd-vert-vif font-display mx-auto mb-3 grid h-22 w-22 place-items-center rounded-full bg-gradient-to-br text-xl font-bold text-white"
                      >
                        {speaker.firstName[0]}
                        {speaker.lastName[0]}
                      </span>
                    )}
                    <b className="font-display text-heading block leading-snug">
                      {speaker.firstName} {speaker.lastName}
                    </b>
                    {speaker.jobTitle && (
                      <span className="text-text-2 mt-1 block text-sm">{speaker.jobTitle}</span>
                    )}
                    {speaker.organization && (
                      <span className="text-text-3 mt-0.5 block text-xs">
                        {speaker.organization}
                      </span>
                    )}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      );
    }

    case "sponsors": {
      const niveaux = donnees.sponsors ?? [];
      if (niveaux.length === 0) return null;

      return (
        <section id={ancre} className={`border-border bg-bg-2 border-b py-16${classeAncre}`}>
          <div className={CADRE}>
            <Reveal>
              <EnteteSection
                surtitre={en ? "With the support of" : "Avec le soutien de"}
                titre={texte(section, "titre", locale) || (en ? "Partners" : "Partenaires")}
              />
            </Reveal>

            {niveaux.map((niveau, rangNiveau) => (
              <Reveal key={niveau.id} delai={rangNiveau * 80}>
                <div className="mb-7">
                  <h3 className="text-text-3 mb-3 flex items-center gap-3 text-sm font-medium">
                    {niveau.name}
                    <span className="bg-border h-px flex-1" />
                  </h3>
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
                          src={`/api/v1/sponsors/${sponsor.id}/logo`}
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
