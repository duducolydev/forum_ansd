import { CalendarDays, Check, DoorOpen, Info, LayoutList, Tag } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { EnteteSection } from "@/components/site/entete-section";
import { BandeauPage, CorpsPage } from "@/components/site/bandeau-page";
import { LienSite } from "@/components/site/bouton-site";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getActiveEdition } from "@/lib/edition";
import { listRooms, listSessions } from "@/modules/sessions/service";
import { TYPE_LABELS } from "@/modules/sessions/schema";
import {
  ProgrammeGrid,
  type SessionAffichable,
} from "@/modules/sessions/components/programme-grid";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("program") };
}

const jourLong = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

interface Filtres {
  jour?: string;
  theme?: string;
  type?: string;
  salle?: string;
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
  const edition = await getActiveEdition();
  const filtres = await searchParams;

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
            surtitre="Trois journées"
            titre={t("program")}
            icone={CalendarDays}
          />
        </BandeauPage>

        <CorpsPage>
          <p className="border-border bg-surface text-text-3 rounded-xl border p-8 text-center">
            Le programme détaillé sera publié prochainement. Les grandes lignes figurent dans la
            présentation du Forum.
          </p>
          <div className="mt-6 flex justify-center">
            <LienSite href="/#a-propos" icone={Info}>
              Découvrir le Forum
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

  const jourActif = jours.find((jour) => jour.iso === filtres.jour) ?? jours[0]!;
  const duJour: SessionAffichable[] = retenues
    .filter((session) => session.day.toISOString().slice(0, 10) === jourActif.iso)
    .map((session) => ({
      id: session.id,
      slug: session.slug,
      type: session.type,
      titre: session.titleFr,
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
          surtitre="Trois journées"
          titre={t("program")}
          icone={CalendarDays}
          description={`${edition.venue}, ${edition.city} · ${jours.length} journée(s) · ${sessions.length} session(s)`}
        />
      </BandeauPage>

      <CorpsPage espacement="compact">
        <nav aria-label="Journées" className="mb-4 flex flex-wrap gap-2">
          {jours.map((jour) => (
            <Pastille
              key={jour.iso}
              actif={jour.iso === jourActif.iso}
              href={lienFiltre({ ...filtres, jour: undefined }, "jour", jour.iso)}
            >
              {jourLong.format(jour.date)}
            </Pastille>
          ))}
        </nav>

        {(themes.length > 0 || salles.length > 0) && (
          <div className="border-border bg-surface mb-8 flex flex-col gap-3 rounded-2xl border p-4">
            {/*
             * Les filtres sont désormais posés dans un panneau et chaque rangée
             * porte son intitulé. Seize pastilles alignées sans distinction se
             * lisaient comme un mur : rien ne disait qu'on choisissait un thème
             * plutôt qu'une salle.
             */}
            {themes.length > 0 && (
              <RangeeFiltres libelle="Thèmes" icone={Tag}>
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

            <RangeeFiltres libelle="Formats" icone={LayoutList}>
              {types.map((type) => (
                <Pastille
                  key={type}
                  actif={filtres.type === type}
                  href={lienFiltre(filtres, "type", type)}
                >
                  {TYPE_LABELS[type]}
                </Pastille>
              ))}
            </RangeeFiltres>

            {salles.length > 0 && (
              <RangeeFiltres libelle="Salles" icone={DoorOpen}>
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
        )}

        <ProgrammeGrid
          sessions={duJour}
          salles={salles.map((salle) => ({ id: salle.id, name: salle.name }))}
        />
      </CorpsPage>
    </>
  );
}
