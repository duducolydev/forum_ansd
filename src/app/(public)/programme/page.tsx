import { lireLangue, localeIntl, selon, traduire, type Langue } from "@/lib/langue";
import {
  CalendarDays,
  Check,
  Columns3,
  DoorOpen,
  Handshake,
  Info,
  LayoutList,
  ListTree,
  Store,
  Tag,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { EnteteSection } from "@/components/site/entete-section";
import { FiltresRepliables } from "@/components/site/filtres-repliables";
import { BandeauPage, CorpsPage } from "@/components/site/bandeau-page";
import { LienSite } from "@/components/site/bouton-site";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { getActiveEdition } from "@/lib/edition";
import { listRooms, listSessions } from "@/modules/sessions/service";
import {
  ProgrammeGrid,
  type SessionAffichable,
} from "@/modules/sessions/components/programme-grid";
import { ProgrammeFrise } from "@/modules/sessions/components/programme-frise";
import { libelleEtat, libelleType } from "@/modules/sessions/libelles";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("program") };
}

interface Filtres {
  jour?: string;
  theme?: string;
  type?: string;
  salle?: string;
  /** `salles` : grille par salle ; sinon, frise des créneaux. */
  vue?: string;
}

/** Un filtre actif se retire en le rappuyant : la même pastille sert d'aller et de retour. */
function lienFiltre(filtres: Filtres, cle: keyof Filtres, valeur: string): string {
  const parametres = new URLSearchParams(
    Object.entries(filtres).filter(([, v]) => Boolean(v)) as [string, string][],
  );
  if (parametres.get(cle) === valeur) parametres.delete(cle);
  else parametres.set(cle, valeur);
  const suite = parametres.toString();
  return suite ? `/programme?${suite}` : "/programme";
}

/** Bascule d'affichage : on garde les filtres, on change seulement la vue. */
function lienVue(filtres: Filtres, vue: "salles" | null): string {
  const parametres = new URLSearchParams(
    Object.entries({ ...filtres, vue: vue ?? undefined }).filter(([, v]) => Boolean(v)) as [
      string,
      string,
    ][],
  );
  const suite = parametres.toString();
  return suite ? `/programme?${suite}` : "/programme";
}

function Pastille({
  actif,
  href,
  children,
}: {
  actif: boolean;
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={actif ? "true" : undefined}
      className={`transition-tout inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm no-underline ${
        actif
          ? "border-primary bg-primary text-primary-text shadow-sm"
          : "border-border bg-surface text-text-2 hover:border-link hover:text-heading hover:-translate-y-0.5 hover:shadow-sm"
      }`}
    >
      {/* Une coche sur le filtre actif : l'état ne repose alors pas sur la
          seule couleur, que tout le monde ne distingue pas également. */}
      {actif && <Check aria-hidden size={13} strokeWidth={3} />}
      {children}
    </Link>
  );
}

/** Une rangée de filtres, avec son intitulé et son icône. */
function RangeeFiltres({
  libelle,
  icone: Icone,
  children,
}: {
  libelle: string;
  icone: LucideIcon;
  children: ReactNode;
}) {
  return (
    <nav aria-label={libelle} className="flex flex-wrap items-center gap-2">
      <span className="text-text-2 flex w-20 shrink-0 items-center gap-1.5 text-xs font-bold tracking-wide uppercase">
        <Icone aria-hidden size={13} />
        {libelle}
      </span>
      {children}
    </nav>
  );
}

/**
 * L'exposition des stands, ouverte toute la journée pendant les trois jours
 * (demande du 24 octobre 2026). Ce n'est pas une session : le comité ne l'a pas
 * saisie au programme, et une carte du matin au soir aurait recouvert la frise.
 * Elle est signalée sous le titre de chaque journée, quels que soient les
 * filtres, puisqu'elle ne dépend ni d'une salle ni d'un format.
 */
function BandeauExposition({ locale }: { locale: Langue }) {
  return (
    <aside className="border-border bg-surface mb-6 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:gap-4">
      <span
        aria-hidden
        className="bg-gold-soft text-gold-text flex size-11 shrink-0 items-center justify-center rounded-xl"
      >
        <Store size={20} />
      </span>
      <div className="flex-1">
        <p className="text-heading flex flex-wrap items-center gap-x-2 gap-y-1 font-bold">
          {selon(locale, {
            fr: "Exposition des stands",
            en: "Stands exhibition",
            pt: "Exposição dos stands",
          })}
          <span className="bg-gold-soft text-gold-text rounded-full px-2.5 py-0.5 text-xs font-semibold">
            {selon(locale, { fr: "Toute la journée", en: "All day", pt: "Todo o dia" })}
          </span>
        </p>
        <p className="text-text-2 mt-1 text-sm">
          {selon(locale, {
            fr: "Les stands sont ouverts tout au long de la journée, en parallèle des sessions.",
            en: "The stands are open throughout the day, alongside the sessions.",
            pt: "Os stands estão abertos durante todo o dia, em paralelo com as sessões.",
          })}
        </p>
      </div>
      <LienSite href="/sponsors" ton="discret" taille="compact" icone={Handshake}>
        {selon(locale, {
          fr: "Voir les partenaires",
          en: "See the partners",
          pt: "Ver os parceiros",
        })}
      </LienSite>
    </aside>
  );
}

export default async function ProgramPage({ searchParams }: { searchParams: Promise<Filtres> }) {
  const t = await getTranslations("nav");
  const locale = lireLangue(await getLocale());
  const edition = await getActiveEdition();
  const filtres = await searchParams;
  const jourLong = new Intl.DateTimeFormat(localeIntl(locale), {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  const surtitre = selon(locale, { fr: "Trois journées", en: "Three days", pt: "Três dias" });
  // « Lundi 23 novembre » : une seule capitale, juste en français comme en
  // portugais (« Segunda-feira, 23 de novembro »).
  const capitale = (texte: string) => texte.charAt(0).toUpperCase() + texte.slice(1);
  const nomDuJour = (date: Date) => capitale(jourLong.format(date));
  // Sur un téléphone, « Lun. 23 nov. » : les trois onglets tiennent sur une ligne.
  const jourCourt = new Intl.DateTimeFormat(localeIntl(locale), {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

  const [sessions, salles] = await Promise.all([
    listSessions(edition.id, { onlyPublished: true }),
    listRooms(edition.id),
  ]);

  if (sessions.length === 0) {
    return (
      <>
        <BandeauPage>
          <EnteteSection
            bandeau
            niveau="h1"
            surtitre={surtitre}
            titre={t("program")}
            icone={CalendarDays}
          />
        </BandeauPage>

        <CorpsPage>
          <p className="border-border bg-surface text-text-3 rounded-xl border p-8 text-center">
            {selon(locale, {
              fr: "Le programme détaillé sera publié prochainement. Les grandes lignes figurent dans la présentation du Forum.",
              en: "The detailed programme will be published shortly. The main lines are set out in the presentation of the Forum.",
              pt: "O programa detalhado será publicado em breve. As grandes linhas constam da apresentação do Fórum.",
            })}
          </p>
          <div className="mt-6 flex justify-center">
            <LienSite href="/#a-propos" icone={Info}>
              {selon(locale, {
                fr: "Découvrir le Forum",
                en: "Discover the Forum",
                pt: "Descobrir o Fórum",
              })}
            </LienSite>
          </div>
        </CorpsPage>
      </>
    );
  }

  const themes = [...new Set(sessions.map((s) => s.theme).filter((x): x is string => Boolean(x)))];
  const types = [...new Set(sessions.map((s) => s.type))];

  const retenues = sessions.filter(
    (session) =>
      (!filtres.theme || session.theme === filtres.theme) &&
      (!filtres.type || session.type === filtres.type) &&
      (!filtres.salle || session.room?.id === filtres.salle),
  );

  const jours = [...new Set(sessions.map((session) => session.day.toISOString().slice(0, 10)))]
    .sort()
    .map((iso) => ({ iso, date: new Date(`${iso}T00:00:00.000Z`) }));

  /*
   * Une journée à la fois, en onglets côte à côte (demande du 24 octobre
   * 2026) : changer de jour ne demande plus de faire défiler les deux autres.
   * Chaque onglet est un lien — une journée se partage par son adresse
   * (`?jour=…`) — et garde les filtres et la vue en cours. Par défaut, la
   * journée du jour pendant le Forum, la première sinon.
   */
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const jourActif =
    jours.find((jour) => jour.iso === filtres.jour) ??
    jours.find((jour) => jour.iso === aujourdhui) ??
    jours[0]!;
  const vueSalles = filtres.vue === "salles";
  const nbActifs = [filtres.theme, filtres.type, filtres.salle].filter(Boolean).length;
  const duJour: SessionAffichable[] = retenues
    .filter((session) => session.day.toISOString().slice(0, 10) === jourActif.iso)
    .map((session) => ({
      id: session.id,
      slug: session.slug,
      type: session.type,
      titre: traduire(locale, {
        fr: session.titleFr,
        en: session.titleEn,
        pt: session.titlePt,
      }),
      theme: session.theme,
      debut: session.startTime,
      fin: session.endTime,
      salle: session.room ? { id: session.room.id, name: session.room.name } : null,
      places: session.places,
    }));

  return (
    <>
      <BandeauPage>
        <EnteteSection
          bandeau
          niveau="h1"
          surtitre={surtitre}
          titre={t("program")}
          icone={CalendarDays}
        />
      </BandeauPage>

      <CorpsPage espacement="compact">
        {/*
         * Onglets de journée, soulignement animé (brief « Constellation » §6).
         * `scroll={false}` : changer de jour ne ramène pas en haut de page.
         */}
        <nav
          aria-label={selon(locale, { fr: "Journées", en: "Days", pt: "Dias" })}
          className="onglets-jour mb-6"
        >
          {jours.map((jour) => (
            <Link
              key={jour.iso}
              href={lienFiltre({ ...filtres, jour: undefined }, "jour", jour.iso)}
              scroll={false}
              aria-current={jour.iso === jourActif.iso ? "page" : undefined}
              className="onglet-jour"
            >
              <span className="sm:hidden">{capitale(jourCourt.format(jour.date))}</span>
              <span className="hidden sm:inline">{nomDuJour(jour.date)}</span>
            </Link>
          ))}
        </nav>

        <FiltresRepliables
          libelle={selon(locale, { fr: "Filtres", en: "Filters", pt: "Filtros" })}
          nbActifs={nbActifs}
          actions={
            <nav
              aria-label={selon(locale, { fr: "Affichage", en: "Display", pt: "Apresentação" })}
              className="flex gap-1.5"
            >
              <Pastille actif={!vueSalles} href={lienVue(filtres, null)}>
                <ListTree aria-hidden size={14} />
                {selon(locale, { fr: "Frise", en: "Timeline", pt: "Cronologia" })}
              </Pastille>
              <Pastille actif={vueSalles} href={lienVue(filtres, "salles")}>
                <Columns3 aria-hidden size={14} />
                {selon(locale, { fr: "Par salle", en: "By room", pt: "Por sala" })}
              </Pastille>
            </nav>
          }
        >
          <div className="border-border bg-surface flex flex-col gap-3 rounded-2xl border p-4">
            {/*
             * Les filtres sont posés dans un panneau et chaque rangée porte son
             * intitulé. Seize pastilles alignées sans distinction se lisaient
             * comme un mur : rien ne disait qu'on choisissait un thème plutôt
             * qu'une salle.
             */}
            {themes.length > 0 && (
              <RangeeFiltres
                libelle={selon(locale, { fr: "Thèmes", en: "Themes", pt: "Temas" })}
                icone={Tag}
              >
                {themes.map((theme) => (
                  <Pastille
                    key={theme}
                    actif={filtres.theme === theme}
                    href={lienFiltre(filtres, "theme", theme)}
                  >
                    {theme}
                  </Pastille>
                ))}
              </RangeeFiltres>
            )}

            <RangeeFiltres
              libelle={selon(locale, { fr: "Formats", en: "Formats", pt: "Formatos" })}
              icone={LayoutList}
            >
              {types.map((type) => (
                <Pastille
                  key={type}
                  actif={filtres.type === type}
                  href={lienFiltre(filtres, "type", type)}
                >
                  {libelleType(type, locale)}
                </Pastille>
              ))}
            </RangeeFiltres>

            {salles.length > 0 && (
              <RangeeFiltres
                libelle={selon(locale, { fr: "Salles", en: "Rooms", pt: "Salas" })}
                icone={DoorOpen}
              >
                {salles.map((salle) => (
                  <Pastille
                    key={salle.id}
                    actif={filtres.salle === salle.id}
                    href={lienFiltre(filtres, "salle", salle.id)}
                  >
                    {salle.name}
                  </Pastille>
                ))}
              </RangeeFiltres>
            )}
          </div>
        </FiltresRepliables>

        <section aria-labelledby="journee-active">
          {/* Le jour est déjà dit par l'onglet actif : titre pour les lecteurs d'écran. */}
          <h2 id="journee-active" className="sr-only">
            {nomDuJour(jourActif.date)}
          </h2>
          <BandeauExposition locale={locale} />
          {/* Les deux vues annoncent elles-mêmes une journée vide après filtrage. */}
          {vueSalles ? (
            <ProgrammeGrid
              sessions={duJour}
              salles={salles.map((salle) => ({ id: salle.id, name: salle.name }))}
              locale={locale}
            />
          ) : (
            <ProgrammeFrise
              locale={locale}
              sessions={duJour.map((session) => ({
                id: session.id,
                slug: session.slug,
                type: session.type,
                titre: session.titre,
                theme: session.theme,
                debut: session.debut.toISOString(),
                fin: session.fin.toISOString(),
                salle: session.salle?.name ?? null,
                etat:
                  session.places.etat === "SANS_RESERVATION"
                    ? null
                    : libelleEtat(session.places.etat, locale),
              }))}
            />
          )}
        </section>
      </CorpsPage>
    </>
  );
}
