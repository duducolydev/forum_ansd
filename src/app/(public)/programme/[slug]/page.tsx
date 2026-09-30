import { lireLangue, localeIntl, selon, traduire } from "@/lib/langue";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  FileText,
  MapPin,
  Radio,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import { getActiveEdition } from "@/lib/edition";
import { getLocale } from "next-intl/server";
import { getSessionBySlug } from "@/modules/sessions/service";
import { libelleEtat, libelleRole, libelleType } from "@/modules/sessions/libelles";
import { prisma } from "@/lib/db";
import { getParticipantSession } from "@/modules/auth/participant-session";
import {
  RegisterButton,
  type StatutParticipant,
} from "@/modules/sessions/components/register-button";
import { BandeauPage, CorpsPage } from "@/components/site/bandeau-page";
import { LienSite, LienSiteExterne } from "@/components/site/bouton-site";
import { Reveal } from "@/components/site/reveal";
import { listerPubliees } from "@/modules/contributions/service";
import { BlocContribution } from "@/modules/contributions/components/bloc-public";
import { SplitTitle } from "@/components/motion/SplitTitle";

export const dynamic = "force-dynamic";

function heure(date: Date): string {
  return `${String(date.getUTCHours()).padStart(2, "0")}h${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

/** Repère factuel du bandeau : jour, horaire, salle. */
function Repere({ icone: Icone, children }: { icone: LucideIcon; children: ReactNode }) {
  return (
    <span className="border-border bg-surface/70 text-text-2 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium backdrop-blur">
      <Icone aria-hidden size={14} className="text-accent-text shrink-0" />
      {children}
    </span>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const edition = await getActiveEdition();
  const session = await getSessionBySlug(edition.id, slug);
  const locale = await getLocale();
  return {
    title: session
      ? traduire(locale, { fr: session.titleFr, en: session.titleEn, pt: session.titlePt })
      : "Session",
  };
}

export default async function SessionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = lireLangue(await getLocale());
  const edition = await getActiveEdition();
  const session = await getSessionBySlug(edition.id, slug);
  const jourLong = new Intl.DateTimeFormat(localeIntl(locale), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  // Une session en brouillon n'existe pas pour le public : 404 et non 403, pour
  // ne pas révéler qu'un panel est en préparation sous ce nom.
  if (!session || !session.isPublished) notFound();

  // Les intervenants non publiés ne sont pas annoncés : un panéliste pressenti
  // qui se désiste après avoir été affiché est un incident de protocole.
  const intervenants = session.speakers.filter((lien) => lien.speaker.isPublished);

  // L'état de réservation du visiteur, s'il est connecté à son espace.
  const contributions = await listerPubliees(session.id);

  const participant = await getParticipantSession();
  const inscription = participant
    ? await prisma.sessionRegistration.findUnique({
        where: {
          sessionId_participantId: {
            sessionId: session.id,
            participantId: participant.participantId,
          },
        },
        select: { status: true },
      })
    : null;
  const statut: StatutParticipant =
    inscription && inscription.status !== "CANCELLED"
      ? (inscription.status as StatutParticipant)
      : "AUCUN";

  const titreSeance = traduire(locale, {
    fr: session.titleFr,
    en: session.titleEn,
    pt: session.titlePt,
  });
  const description = traduire(locale, {
    fr: session.descriptionFr,
    en: session.descriptionEn,
    pt: session.descriptionPt,
  });
  const bioDe = (speaker: { bioFr: string | null; bioEn: string | null; bioPt: string | null }) =>
    traduire(locale, { fr: speaker.bioFr, en: speaker.bioEn, pt: speaker.bioPt });

  const complet =
    session.places.capacite !== null && session.places.capacite > 0
      ? Math.min(100, Math.round((session.places.inscrits / session.places.capacite) * 100))
      : null;

  return (
    <article>
      <BandeauPage largeur="moyen" filCourant={titreSeance}>
        <SplitTitle texte={titreSeance} delaiInitial={0.1} className="titre-page" />
      </BandeauPage>

      <CorpsPage largeur="moyen" className="flex flex-col gap-10">
        {/* Retour, format et repères : en tête du contenu, le bandeau ne
            porte plus que le titre (29 septembre 2026). */}
        <div className="flex flex-col gap-3">
          <LienSite
            href="/programme"
            ton="discret"
            taille="compact"
            icone={ArrowLeft}
            className="self-start"
          >
            {selon(locale, { fr: "Programme", en: "Programme", pt: "Programa" })}
          </LienSite>
          <p className="surtitre">
            {libelleType(session.type, locale)}
            {session.theme ? ` · ${session.theme}` : ""}
          </p>
          <div className="flex flex-wrap gap-2.5">
            <Repere icone={CalendarDays}>{jourLong.format(session.day)}</Repere>
            <Repere icone={Clock}>
              {heure(session.startTime)} – {heure(session.endTime)}
            </Repere>
            {session.room && <Repere icone={MapPin}>{session.room.name}</Repere>}
          </div>
        </div>
        {session.places.etat !== "SANS_RESERVATION" && (
          <Reveal>
            <div className="filet-haut border-border bg-surface relative overflow-hidden rounded-2xl border p-6">
              <p className="text-heading flex flex-wrap items-center gap-2 text-sm font-semibold">
                <Users aria-hidden size={16} className="text-accent-text" />
                {libelleEtat(session.places.etat, locale)}
                {session.places.capacite !== null && (
                  <span className="text-text-3 font-normal">
                    · {session.places.inscrits} / {session.places.capacite}{" "}
                    {selon(locale, { fr: "inscrits", en: "registered", pt: "inscritos" })}
                    {session.places.attente > 0 &&
                      ` · ${session.places.attente} ${selon(locale, { fr: "en attente", en: "waiting", pt: "em espera" })}`}
                  </span>
                )}
              </p>

              {/*
               * Jauge de remplissage : décorative et redondante avec le compte
               * chiffré juste au-dessus, donc `aria-hidden`. Un lecteur d'écran
               * qui annoncerait « 72 % » sans dire de quoi n'apprendrait rien.
               */}
              {complet !== null && (
                <span aria-hidden className="bg-bg-2 mt-3.5 block h-1.5 rounded-full">
                  <span
                    className="from-ansd-bleu-vif to-ansd-vert-vif block h-full rounded-full bg-gradient-to-r"
                    style={{ width: `${complet}%` }}
                  />
                </span>
              )}

              <div className="mt-4">
                <RegisterButton
                  sessionId={session.id}
                  etat={session.places.etat}
                  statut={statut}
                  connecte={participant !== null}
                  locale={locale}
                />
              </div>
            </div>
          </Reveal>
        )}

        {description && (
          <Reveal>
            <section>
              <h2 className="mb-3 flex items-center gap-2.5 text-lg">
                <FileText aria-hidden size={19} className="text-accent-text" />
                {selon(locale, { fr: "Présentation", en: "Overview", pt: "Apresentação" })}
              </h2>
              <p className="text-text-2 leading-relaxed whitespace-pre-line">{description}</p>
            </section>
          </Reveal>
        )}

        {session.objectives && (
          <Reveal>
            <section className="bg-bg-2 border-border rounded-2xl border p-6">
              <h2 className="mb-3 flex items-center gap-2.5 text-lg">
                <Target aria-hidden size={19} className="text-accent-text" />
                {selon(locale, { fr: "Objectifs", en: "Objectives", pt: "Objetivos" })}
              </h2>
              <p className="text-text-2 leading-relaxed whitespace-pre-line">
                {session.objectives}
              </p>
            </section>
          </Reveal>
        )}

        {(session.tdrPath || session.liveStreamUrl) && (
          <div className="flex flex-wrap gap-3">
            {session.tdrPath && (
              <LienSiteExterne href={`/api/v1/sessions/${session.id}/tdr`} icone={FileText}>
                {selon(locale, {
                  fr: "Termes de référence (PDF)",
                  en: "Terms of reference (PDF)",
                  pt: "Termos de referência (PDF)",
                })}
              </LienSiteExterne>
            )}
            {session.liveStreamUrl && (
              <LienSiteExterne
                href={session.liveStreamUrl}
                target="_blank"
                ton="principal"
                icone={Radio}
              >
                {selon(locale, {
                  fr: "Suivre en direct",
                  en: "Watch live",
                  pt: "Acompanhar em direto",
                })}
              </LienSiteExterne>
            )}
          </div>
        )}

        {intervenants.length > 0 && (
          <section>
            <h2 className="mb-5 flex items-center gap-4 text-base">
              <span className="surtitre">
                {selon(locale, { fr: "Intervenants", en: "Speakers", pt: "Oradores" })}
              </span>
              <span className="from-border h-px flex-1 bg-gradient-to-r to-transparent" />
              <span className="text-text-3 text-sm font-normal">{intervenants.length}</span>
            </h2>
            <ul className="flex flex-col gap-3.5">
              {intervenants.map((lien, rang) => (
                <Reveal key={lien.speaker.id} delai={rang * 60}>
                  <li className="border-border bg-surface carte-relief flex gap-4 rounded-xl border p-5">
                    {/* Initiales plutôt qu'une photo : la fiche de session ne
                        charge pas les portraits, qui vivent sur /intervenants. */}
                    <span
                      aria-hidden
                      className="bg-blue-soft text-blue-text font-display grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold"
                    >
                      {lien.speaker.firstName.charAt(0)}
                      {lien.speaker.lastName.charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-accent-text text-xs font-semibold tracking-wide uppercase">
                        {libelleRole(lien.role, locale)}
                      </p>
                      <p className="text-heading font-semibold">
                        {lien.speaker.firstName} {lien.speaker.lastName}
                      </p>
                      <p className="text-text-3 text-sm">
                        {[lien.speaker.jobTitle, lien.speaker.organization, lien.speaker.country]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {bioDe(lien.speaker) && (
                        <details className="mt-2.5">
                          <summary className="text-link hover:text-secondary-hover cursor-pointer text-sm font-semibold">
                            {selon(locale, { fr: "Biographie", en: "Biography", pt: "Biografia" })}
                          </summary>
                          <p className="text-text-2 mt-2 text-sm leading-relaxed whitespace-pre-line">
                            {bioDe(lien.speaker)}
                          </p>
                        </details>
                      )}
                    </div>
                  </li>
                </Reveal>
              ))}
            </ul>
          </section>
        )}

        {contributions.length > 0 && (
          <section>
            <h2 className="mb-5 flex items-center gap-4 text-base">
              <span className="surtitre">Contributions</span>
              <span className="from-border h-px flex-1 bg-gradient-to-r to-transparent" />
              <span className="text-text-3 text-sm font-normal">{contributions.length}</span>
            </h2>
            <div className="flex flex-col gap-4">
              {contributions.map((contribution, rang) => (
                <Reveal key={contribution.id} delai={rang * 50}>
                  <BlocContribution contribution={contribution} />
                </Reveal>
              ))}
            </div>
          </section>
        )}

        <div className="border-border flex flex-wrap gap-3 border-t pt-8">
          <LienSite href="/programme" icone={CalendarDays}>
            {selon(locale, {
              fr: "Revenir au programme",
              en: "Back to the programme",
              pt: "Voltar ao programa",
            })}
          </LienSite>
        </div>
      </CorpsPage>
    </article>
  );
}
