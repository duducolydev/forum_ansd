import { avecCivilite, civiliteIntervenant } from "@/lib/civilite";
import Image from "next/image";
import { photoIntervenant } from "@/modules/speakers/photo";
import { BiographieIntervenant } from "@/components/site/biographie-intervenant";
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
import {
  libelleEtat,
  libelleRole,
  libelleType,
  RESERVATION_PUBLIQUE,
} from "@/modules/sessions/libelles";
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
      <BandeauPage
        largeur="moyen"
        filCourant={titreSeance}
        // Retour au programme sur la ligne du fil d'Ariane (27 octobre 2026).
        actionFil={
          <LienSite href="/programme" ton="discret" taille="compact" icone={ArrowLeft}>
            {selon(locale, { fr: "Programme", en: "Programme", pt: "Programa" })}
          </LienSite>
        }
      >
        <SplitTitle texte={titreSeance} delaiInitial={0.1} className="titre-page" />
      </BandeauPage>

      <CorpsPage largeur="moyen" className="flex flex-col gap-10">
        {/* Format et repères : en tête du contenu, le bandeau ne porte plus
            que le titre (29 septembre 2026). */}
        <div className="flex flex-col gap-3">
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

        {/*
         * Intervenants en vedette, juste sous les repères (27 octobre 2026) : ils
         * étaient en bas de page, après la présentation, et c'est souvent eux
         * qu'on vient chercher. En grille, deux ou trois par ligne.
         */}
        {intervenants.length > 0 && (
          <section>
            <h2 className="mb-5 flex items-center gap-4 text-base">
              <span className="surtitre">
                {selon(locale, { fr: "Intervenants", en: "Speakers", pt: "Oradores" })}
              </span>
              <span className="from-border h-px flex-1 bg-gradient-to-r to-transparent" />
              <span className="text-text-3 text-sm font-normal">{intervenants.length}</span>
            </h2>
            <ul className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {intervenants.map((lien, rang) => (
                <li key={lien.speaker.id}>
                  <Reveal delai={rang * 60} className="h-full">
                    <div className="border-border bg-surface carte-relief flex h-full flex-col rounded-xl border p-5">
                      {/*
                       * Portrait en grand, avec l'anneau des cartes de
                       * /intervenants (5 novembre 2026) : la pastille de 44 px
                       * n'affichait que des initiales, et c'est le visage qu'on
                       * vient chercher sur la fiche d'un panel. Repli sur la
                       * photo du participant lié, comme sur l'annuaire.
                       */}
                      <div className="text-center">
                        <div className="avatar-anneau">
                          <span className="avatar-anneau__contenu">
                            {photoIntervenant(lien.speaker) ? (
                              <Image
                                src={`/api/v1/speakers/${lien.speaker.id}/photo`}
                                alt=""
                                fill
                                sizes="118px"
                                unoptimized
                                className="object-cover"
                              />
                            ) : (
                              <span aria-hidden>
                                {lien.speaker.firstName.charAt(0)}
                                {lien.speaker.lastName.charAt(0)}
                              </span>
                            )}
                          </span>
                        </div>
                        <p className="text-accent-text text-xs font-semibold tracking-wide uppercase">
                          {libelleRole(lien.role, locale)}
                        </p>
                        <p className="text-heading mt-0.5 text-lg leading-snug font-semibold">
                          {avecCivilite(
                            civiliteIntervenant(lien.speaker),
                            `${lien.speaker.firstName} ${lien.speaker.lastName}`,
                            locale,
                          )}
                        </p>
                      </div>
                      <p className="text-text-3 mt-2 text-center text-sm leading-relaxed">
                        {[lien.speaker.jobTitle, lien.speaker.organization, lien.speaker.country]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {/*
                       * Extrait, et la biographie entière dans une fenêtre
                       * (5 novembre 2026) : dépliée dans la carte, une
                       * biographie de 600 mots l'allongeait de toute sa hauteur
                       * et décalait la grille.
                       */}
                      {bioDe(lien.speaker) && (
                        <div className="mt-auto flex flex-col items-start gap-2 pt-3">
                          <BiographieIntervenant
                            bio={bioDe(lien.speaker)!}
                            limite={280}
                            nom={avecCivilite(
                              civiliteIntervenant(lien.speaker),
                              `${lien.speaker.firstName} ${lien.speaker.lastName}`,
                              locale,
                            )}
                            sousTitre={[lien.speaker.jobTitle, lien.speaker.organization]
                              .filter(Boolean)
                              .join(" · ")}
                            photoUrl={
                              photoIntervenant(lien.speaker)
                                ? `/api/v1/speakers/${lien.speaker.id}/photo`
                                : null
                            }
                            initiales={`${lien.speaker.firstName.charAt(0)}${lien.speaker.lastName.charAt(0)}`}
                            langue={locale}
                            classeExtrait="text-text-2 text-sm leading-relaxed whitespace-pre-line"
                            classeBouton="text-link hover:text-secondary-hover inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold"
                          />
                        </div>
                      )}
                    </div>
                  </Reveal>
                </li>
              ))}
            </ul>
          </section>
        )}

        {RESERVATION_PUBLIQUE && session.places.etat !== "SANS_RESERVATION" && (
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
