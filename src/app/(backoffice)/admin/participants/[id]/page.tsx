import { avecCivilite } from "@/lib/civilite";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { LienBouton } from "@/components/ui/bouton";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import * as service from "@/modules/participants/service";
import { StatusBadge } from "@/modules/participants/components/status-badge";
import { TransitionActions } from "@/modules/participants/components/transition-actions";
import { SuppressionParticipant } from "@/modules/participants/components/suppression-participant";
import { BadgePanel } from "@/modules/badges/components/badge-panel";
import { prisma } from "@/lib/db";
import { LogStatusBadge } from "@/modules/notifications/components/log-status-badge";
import { getSpeakerDuParticipant, sessionsPourRattachement } from "@/modules/speakers/service";
import { SessionsIntervenant } from "@/modules/speakers/components/sessions-intervenant";
import { PhotoFiche } from "@/components/ui/photo-fiche";

const quand = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export default async function ParticipantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user || !can(session, "participants.read")) {
    redirect("/admin");
  }

  const { id } = await params;
  const participant = await service.getParticipant(id);
  if (!participant) notFound();

  // Historique d'envoi du participant (brief §5.13) : utile pour répondre à
  // « je n'ai rien reçu » sans fouiller les journaux du serveur SMTP.
  const notifications = await prisma.notificationLog.findMany({
    where: { participantId: participant.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // Rôle au programme (panéliste, modérateur…) : le gestionnaire programme le
  // donne d'ici, sans ressaisir la personne comme intervenant.
  const peutProgrammer = can(session, "speakers.write");
  const [intervenant, sessionsProgramme] = peutProgrammer
    ? await Promise.all([
        getSpeakerDuParticipant(participant.id),
        sessionsPourRattachement(participant.editionId),
      ])
    : [null, []];

  // Photo : la sienne, sinon celle de sa fiche intervenant — celle que porte
  // aussi son badge (`badges/service.ts`). La seconde passe par la route des
  // intervenants, qui exige `speakers.read` tant que la fiche n'est pas publiée.
  const ficheIntervenant =
    participant.photoPath || !can(session, "speakers.read")
      ? null
      : await prisma.speaker.findFirst({
          where: { participantId: participant.id, deletedAt: null, photoPath: { not: null } },
          select: { id: true },
        });
  const photo = participant.photoPath
    ? { src: `/api/v1/participants/${participant.id}/photo`, legende: undefined }
    : ficheIntervenant
      ? {
          src: `/api/v1/speakers/${ficheIntervenant.id}/photo`,
          legende: "Photo de sa fiche intervenant",
        }
      : { src: null, legende: undefined };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <PhotoFiche
            src={photo.src}
            legende={photo.legende}
            initiales={`${participant.firstName.charAt(0)}${participant.lastName.charAt(0)}`.toUpperCase()}
          />
          <div className="min-w-0">
            <span className="text-text-3 text-sm">{participant.publicId}</span>
            <h2 className="text-2xl">
              {avecCivilite(
                participant.civility,
                `${participant.firstName} ${participant.lastName}`,
              )}
            </h2>
            <div className="mt-2 flex items-center gap-2">
              <StatusBadge status={participant.status} />
              <span className="text-text-3 text-sm">{participant.category.labelFr}</span>
              {participant.category.requiresAccreditation && (
                <span className="bg-gold-soft text-gold-text rounded-md px-2 py-0.5 text-xs font-semibold">
                  {participant.accreditedAt ? "Presse accréditée" : "Accréditation presse requise"}
                </span>
              )}
            </div>
          </div>
        </div>
        {can(session, "participants.write") && (
          <LienBouton href={`/admin/participants/${participant.id}/modifier`} icone={Pencil}>
            Modifier
          </LienBouton>
        )}
      </div>

      {can(session, "participants.write") && (
        <div className="border-border bg-surface mb-5 rounded-xl border p-4">
          <TransitionActions
            participantId={participant.id}
            status={participant.status}
            accreditation={participant.category.requiresAccreditation}
            peutAccrediter={can(session, "participants.accredit")}
          />
        </div>
      )}

      <dl className="border-border bg-surface grid grid-cols-1 gap-x-6 gap-y-3 rounded-xl border p-5 text-sm md:grid-cols-2">
        <Info label="E-mail" value={participant.email} />
        <Info label="Téléphone" value={participant.phone} />
        <Info label="Organisation" value={participant.organization} />
        <Info label="Fonction" value={participant.jobTitle} />
        <Info label="Pays" value={participant.country} />
        <Info label="Ville" value={participant.city} />
        <Info label="Délégation" value={participant.delegation?.name} />
        <Info label="Source" value={participant.source} />
        <Info
          label="Inscrit le"
          value={
            participant.registeredAt
              ? new Date(participant.registeredAt).toLocaleString("fr-FR")
              : undefined
          }
        />
        <Info
          label="Confirmé le"
          value={
            participant.confirmedAt
              ? new Date(participant.confirmedAt).toLocaleString("fr-FR")
              : undefined
          }
        />
        {participant.category.requiresAccreditation && (
          <Info
            label="Accréditation presse"
            value={
              participant.accreditedAt
                ? `Accordée le ${new Date(participant.accreditedAt).toLocaleString("fr-FR")}`
                : "En attente"
            }
          />
        )}
      </dl>

      {peutProgrammer && (
        <div className="mt-5">
          <SessionsIntervenant
            speakerId={intervenant?.id ?? null}
            participantId={participant.id}
            titre="Intervenant au programme"
            intro={
              intervenant
                ? "Rôle et statut de confirmation dans chaque session, enregistrés dès qu'on les change."
                : "Pour en faire un panéliste, un modérateur ou un autre intervenant : choisissez la session et le rôle. Sa fiche intervenant est créée à partir de son inscription, en brouillon."
            }
            aPresentation={Boolean(intervenant?.presentationPath)}
            rattachements={(intervenant?.sessions ?? []).map((lien) => ({
              sessionId: lien.session.id,
              titre: lien.session.titleFr,
              quand: quand.format(lien.session.startTime),
              role: lien.role,
              statut: lien.confirmationStatus,
            }))}
            sessions={sessionsProgramme.map((item) => ({
              id: item.id,
              titre: item.titleFr,
              quand: quand.format(item.startTime),
            }))}
          />
          {intervenant && (
            <p className="text-text-3 mt-2 text-xs">
              Biographie, photo et publication sur le site :{" "}
              <Link
                href={`/admin/intervenants/${intervenant.id}/modifier`}
                className="text-accent-text underline"
              >
                fiche intervenant
              </Link>
              {intervenant.isPublished ? " (publiée)." : " (brouillon)."}
            </p>
          )}
        </div>
      )}

      <BadgePanel
        participantId={participant.id}
        canGenerate={can(session, "badges.generate")}
        canRevoke={can(session, "badges.revoke")}
        canPrint={can(session, "badges.print")}
        badges={participant.badges.map((badge) => ({
          id: badge.id,
          version: badge.version,
          generatedAt: badge.generatedAt?.toISOString() ?? null,
          revokedAt: badge.revokedAt?.toISOString() ?? null,
          revokeReason: badge.revokeReason,
          printedCount: badge.printedCount,
          downloadedAt: badge.downloadedAt?.toISOString() ?? null,
          hasFiles: Boolean(badge.pdfPath && badge.pngPath),
        }))}
      />

      <div className="border-border bg-surface mt-5 rounded-xl border p-5">
        <h3 className="text-heading mb-3 text-sm font-semibold">Notifications envoyées</h3>
        {notifications.length === 0 ? (
          <p className="text-text-2 text-sm">Aucune notification envoyée à ce participant.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {notifications.map((log) => (
              <li
                key={log.id}
                className="border-border flex flex-wrap items-center gap-x-3 gap-y-1 border-b pb-2 last:border-0"
              >
                <LogStatusBadge status={log.status} />
                <b className="text-heading">{log.templateKey}</b>
                <span className="text-text-3">
                  {(log.sentAt ?? log.createdAt).toLocaleString("fr-FR")} · {log.to}
                </span>
                {log.error && (
                  <span className="text-danger-text basis-full text-xs">{log.error}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {participant.notes && (
        <div className="border-border bg-surface mt-5 rounded-xl border p-5">
          <h3 className="text-heading mb-2 text-sm font-semibold">Notes internes</h3>
          <p className="text-text-2 text-sm">{participant.notes}</p>
        </div>
      )}

      {can(session, "participants.delete") && (
        <SuppressionParticipant
          participantId={participant.id}
          nom={`${participant.firstName} ${participant.lastName}`}
          email={participant.email}
        />
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-text-3">{label}</dt>
      <dd className="text-heading">{value || "—"}</dd>
    </div>
  );
}
