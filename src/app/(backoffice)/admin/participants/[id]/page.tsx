import { Pencil } from "lucide-react";
import { LienBouton } from "@/components/ui/bouton";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import * as service from "@/modules/participants/service";
import { StatusBadge } from "@/modules/participants/components/status-badge";
import { TransitionActions } from "@/modules/participants/components/transition-actions";
import { BadgePanel } from "@/modules/badges/components/badge-panel";
import { prisma } from "@/lib/db";
import { LogStatusBadge } from "@/modules/notifications/components/log-status-badge";

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

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <span className="text-text-3 text-sm">{participant.publicId}</span>
          <h2 className="text-2xl">
            {participant.firstName} {participant.lastName}
          </h2>
          <div className="mt-2 flex items-center gap-2">
            <StatusBadge status={participant.status} />
            <span className="text-text-3 text-sm">{participant.category.labelFr}</span>
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
          <TransitionActions participantId={participant.id} status={participant.status} />
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
      </dl>

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
