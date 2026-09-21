import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  CalendarDays,
  Camera,
  Clock,
  Download,
  FileImage,
  LogOut,
  ShieldAlert,
  UserPen,
  Users,
} from "lucide-react";
import { getParticipantSession } from "@/modules/auth/participant-session";
import { logoutAction } from "@/modules/participants/my-space-actions";
import { editDeadline, canEditNow, getMySpaceData } from "@/modules/participants/my-space-service";
import { MagicLinkForm } from "@/modules/participants/components/magic-link-form";
import { MyInfoForm } from "@/modules/participants/components/my-info-form";
import { DeletionRequest } from "@/modules/participants/components/deletion-request";
import { PhotoForm } from "@/modules/participants/components/photo-form";
import { StatusBadge } from "@/modules/participants/components/status-badge";
import { BandeauPage, CorpsPage } from "@/components/site/bandeau-page";
import { BoutonSite, LienSite, LienSiteExterne } from "@/components/site/bouton-site";
import { Reveal } from "@/components/site/reveal";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("myRegistrations"), robots: { index: false, follow: false } };
}

/** Toujours dynamique : le contenu dépend du cookie de session participant. */
export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Africa/Dakar",
});

const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Dakar",
});

/**
 * Panneau de l'espace participant.
 *
 * Chaque rubrique porte son icône dans une pastille colorée : la page est une
 * longue colonne de cartes identiques, et le repérage se faisait jusqu'ici en
 * relisant chaque titre.
 */
function Panneau({
  icone: Icone,
  ton,
  titre,
  children,
}: {
  icone: LucideIcon;
  ton: string;
  titre: string;
  children: ReactNode;
}) {
  return (
    <section className="border-border bg-surface carte-relief rounded-2xl border p-6">
      <h2 className="mb-4 flex items-center gap-3 text-xl">
        <span aria-hidden className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${ton}`}>
          <Icone size={17} strokeWidth={2.2} />
        </span>
        {titre}
      </h2>
      {children}
    </section>
  );
}

export default async function MySpacePage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { erreur } = await searchParams;
  const session = await getParticipantSession();
  const participant = session ? await getMySpaceData(session.participantId) : null;

  if (!participant) {
    return (
      <>
        <BandeauPage largeur="etroit">
          <div className="text-center">
            <h1 className="mb-1 flex items-center justify-center gap-3">
              <span
                aria-hidden
                className="bg-blue-soft text-blue-text inline-grid h-10 w-10 shrink-0 place-items-center rounded-xl"
              >
                <BadgeCheck size={20} strokeWidth={2.1} />
              </span>
              Mon espace
            </h1>
            <p className="text-text-2 mx-auto max-w-[68ch]">
              Pas de mot de passe : indiquez votre adresse e-mail, nous vous envoyons un lien
              d&apos;accès valable 30 minutes.
            </p>
          </div>
        </BandeauPage>

        <CorpsPage largeur="etroit">
          <div className="border-border bg-surface rounded-2xl border p-7 shadow-sm">
            <MagicLinkForm linkError={erreur === "lien"} />
          </div>
          <p className="text-text-3 mt-8 text-center text-sm">
            Pas encore inscrit&nbsp;?{" "}
            <LienSite href="/inscription" ton="discret" taille="compact">
              Remplir le formulaire
            </LienSite>
          </p>
        </CorpsPage>
      </>
    );
  }

  const editable = canEditNow(participant.edition.startDate);
  const deadlineLabel = dateFormatter.format(editDeadline(participant.edition.startDate));
  const badge = participant.badges.find((item) => !item.revokedAt) ?? null;
  const isDelegationHead = participant.delegation?.headParticipantId === participant.id;

  return (
    <>
      <BandeauPage largeur="moyen">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="surtitre mb-1">Mon espace</span>
            <h1 className="mb-1">
              Bonjour {participant.firstName} {participant.lastName}
            </h1>
            <p className="text-text-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={participant.status} />
              <span>{participant.category.labelFr}</span>
              <span className="text-text-3">·</span>
              <span className="text-text-3">N° {participant.publicId}</span>
            </p>
          </div>
          <form action={logoutAction}>
            <BoutonSite type="submit" taille="compact" icone={LogOut}>
              Se déconnecter
            </BoutonSite>
          </form>
        </div>
      </BandeauPage>

      <CorpsPage largeur="moyen" className="flex flex-col gap-6">
        <Reveal>
          <Panneau icone={BadgeCheck} ton="bg-accent-soft text-accent-text" titre="Mon badge">
            {badge?.pdfPath ? (
              <div className="flex flex-wrap gap-3">
                <LienSiteExterne
                  href={`/api/v1/badges/${badge.id}/pdf`}
                  ton="principal"
                  icone={Download}
                >
                  Télécharger le badge (PDF)
                </LienSiteExterne>
                {badge.pngPath && (
                  <LienSiteExterne href={`/api/v1/badges/${badge.id}/png`} icone={FileImage}>
                    Version PNG
                  </LienSiteExterne>
                )}
              </div>
            ) : badge ? (
              <p className="text-text-2 flex items-start gap-2">
                <Clock aria-hidden size={16} className="text-text-3 mt-1 shrink-0" />
                Votre badge est en cours de génération. Vous recevrez un e-mail dès qu&apos;il sera
                disponible.
              </p>
            ) : (
              <p className="text-text-2 flex items-start gap-2">
                <Clock aria-hidden size={16} className="text-text-3 mt-1 shrink-0" />
                Votre badge sera généré dès la confirmation de votre inscription par le comité
                d&apos;organisation.
              </p>
            )}
          </Panneau>
        </Reveal>

        <Reveal delai={60}>
          <Panneau icone={Camera} ton="bg-blue-soft text-blue-text" titre="Ma photo">
            <PhotoForm
              participantId={participant.id}
              photoEnregistree={Boolean(participant.photoPath)}
            />
          </Panneau>
        </Reveal>

        <Reveal delai={120}>
          <Panneau icone={UserPen} ton="bg-gold-soft text-gold-text" titre="Mes informations">
            <MyInfoForm
              email={participant.email}
              editable={editable}
              deadlineLabel={deadlineLabel}
              values={{
                civility: participant.civility ?? "",
                firstName: participant.firstName,
                lastName: participant.lastName,
                phone: participant.phone ?? "",
                city: participant.city ?? "",
                organization: participant.organization ?? "",
                jobTitle: participant.jobTitle ?? "",
                dietaryRequirements: participant.dietaryRequirements ?? "",
                specialNeeds: participant.specialNeeds ?? "",
              }}
            />
          </Panneau>
        </Reveal>

        <Reveal delai={180}>
          <Panneau icone={CalendarDays} ton="bg-blue-soft text-blue-text" titre="Mes sessions">
            {participant.sessionRegistrations.length === 0 ? (
              <>
                <p className="text-text-2">
                  Aucune session réservée. Le programme détaillé et la réservation de sessions
                  seront ouverts prochainement.
                </p>
                <div className="mt-4">
                  <LienSite href="/programme" taille="compact" icone={CalendarDays}>
                    Parcourir le programme
                  </LienSite>
                </div>
              </>
            ) : (
              <ul className="flex flex-col gap-3">
                {participant.sessionRegistrations.map((registration) => (
                  <li
                    key={registration.id}
                    className="border-border flex flex-col gap-1 border-b pb-3 last:border-0 last:pb-0"
                  >
                    <b className="text-heading">{registration.session.titleFr}</b>
                    <span className="text-text-3 flex items-center gap-1.5 text-sm">
                      <Clock aria-hidden size={13} />
                      {dateFormatter.format(registration.session.day)} ·{" "}
                      {timeFormatter.format(registration.session.startTime)}–
                      {timeFormatter.format(registration.session.endTime)}
                      {registration.status === "WAITLISTED" && " · liste d'attente"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panneau>
        </Reveal>

        {isDelegationHead && participant.delegation && (
          <Reveal delai={240}>
            <Panneau
              icone={Users}
              ton="bg-accent-soft text-accent-text"
              titre={`Ma délégation — ${participant.delegation.name}`}
            >
              <p className="text-text-3 mb-4 text-sm">
                Vous êtes chef de délégation. {participant.delegation.members.length} membre(s).
              </p>
              <ul className="flex flex-col gap-2">
                {participant.delegation.members.map((member) => (
                  <li key={member.id} className="flex flex-wrap items-center gap-2">
                    <span className="text-heading">
                      {member.firstName} {member.lastName}
                    </span>
                    <StatusBadge status={member.status} />
                    <span className="text-text-3 text-sm">N° {member.publicId}</span>
                  </li>
                ))}
              </ul>
            </Panneau>
          </Reveal>
        )}

        <Reveal delai={300}>
          <Panneau
            icone={ShieldAlert}
            ton="bg-danger-soft text-danger-text"
            titre="Mes données personnelles"
          >
            <DeletionRequest />
          </Panneau>
        </Reveal>
      </CorpsPage>
    </>
  );
}
