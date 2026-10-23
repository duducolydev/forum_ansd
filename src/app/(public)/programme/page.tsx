import { lireLangue, localeIntl, selon, traduire } from "@/lib/langue";
import {
  CalendarDays,
  Check,
  Columns3,
  DoorOpen,
  Info,
  LayoutList,
  ListTree,
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

/** Le même filtrage, sans le critère `cle` (pastille « Tous les jours »). */
function lienSans(filtres: Filtres, cle: keyof Filtres): string {
  return lienVue({ ...filtres, [cle]: undefined }, (filtres.vue as "salles" | undefined) ?? null);
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
  const nomDuJour = (date: Date) => {
    const texte = jourLong.format(date);
    return texte.charAt(0).toUpperCase() + texte.slice(1);
  };

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
   * Tout le programme par défaut (demande du 23 octobre 2026) : les trois
   * journées se suivent, chacune sous son titre. Le jour est devenu un filtre
   * comme les autres ; un lien `?jour=…` déjà partagé montre toujours ce
   * jour-là, panneau des filtres ouvert.
   */
  const jourFiltre = jours.find((jour) => jour.iso === filtres.jour) ?? null;
  const vueSalles = filtres.vue === "salles";
  const nbActifs = [jourFiltre, filtres.theme, filtres.type, filtres.salle].filter(Boolean).length;
  const parJour = (jourFiltre ? [jourFiltre] : jours)
    .map((jour) => ({
      ...jour,
      sessions: retenues
        .filter((session) => session.day.toISOString().slice(0, 10) === jour.iso)
        .map((session): SessionAffichable => ({
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
        })),
    }))
    .filter((jour) => jour.sessions.length > 0);

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
            <RangeeFiltres
              libelle={selon(locale, { fr: "Jours", en: "Days", pt: "Dias" })}
              icone={CalendarDays}
            >
              <Pastille actif={!jourFiltre} href={lienSans(filtres, "jour")}>
                {selon(locale, { fr: "Tous les jours", en: "All days", pt: "Todos os dias" })}
              </Pastille>
              {jours.map((jour) => (
                <Pastille
                  key={jour.iso}
                  actif={jourFiltre?.iso === jour.iso}
                  href={lienFiltre(filtres, "jour", jour.iso)}
                >
                  {nomDuJour(jour.date)}
                </Pastille>
              ))}
            </RangeeFiltres>

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

        {parJour.length === 0 ? (
          <p className="text-text-2 text-sm">
            {selon(locale, {
              fr: "Aucune session ne correspond à ces filtres.",
              en: "No session matches these filters.",
              pt: "Nenhuma sessão corresponde a estes filtros.",
            })}
          </p>
        ) : (
          <div className="flex flex-col gap-14">
            {parJour.map((jour) => (
              <section key={jour.iso} aria-labelledby={`jour-${jour.iso}`}>
                <h2
                  id={`jour-${jour.iso}`}
                  className="text-heading font-display mb-6 text-xl font-bold sm:text-2xl"
                >
                  {nomDuJour(jour.date)}
                </h2>
                {vueSalles ? (
                  <ProgrammeGrid
                    sessions={jour.sessions}
                    salles={salles.map((salle) => ({ id: salle.id, name: salle.name }))}
                    locale={locale}
                  />
                ) : (
                  <ProgrammeFrise
                    locale={locale}
                    sessions={jour.sessions.map((session) => ({
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
            ))}
          </div>
        )}
      </CorpsPage>
    </>
  );
}
