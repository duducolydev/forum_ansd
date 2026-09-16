import { Send } from "lucide-react";
import { LienBouton } from "@/components/ui/bouton";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { getActiveEdition } from "@/lib/edition";
import {
  listTemplates,
  templateVariables,
  undeclaredVariables,
} from "@/modules/notifications/service";
import { LogStatusBadge } from "@/modules/notifications/components/log-status-badge";
import { apercu } from "@/modules/notifications/reminders";
import { ReminderPlanner } from "@/modules/notifications/components/reminder-planner";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user || !can(session, "notifications.manage")) {
    redirect("/admin");
  }

  const edition = await getActiveEdition();
  const templates = await listTemplates(edition.id);

  const [logs, counts, plans] = await Promise.all([
    prisma.notificationLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { participant: { select: { firstName: true, lastName: true, publicId: true } } },
    }),
    prisma.notificationLog.groupBy({ by: ["status"], _count: { _all: true } }),
    apercu(edition.id, edition.startDate),
  ]);

  const quand = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "UTC",
  });

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl">Notifications</h2>
          <span className="text-text-3 text-sm">
            Modèles d&apos;e-mail et historique d&apos;envoi
          </span>
        </div>
        {can(session, "notifications.send_bulk") && (
          <LienBouton href="/admin/notifications/envoi" ton="principal" icone={Send}>
            Envoi groupé
          </LienBouton>
        )}
      </div>

      {can(session, "notifications.send_bulk") && (
        <div className="mb-6">
          <ReminderPlanner
            plans={plans.map((plan) => ({
              cle: plan.cle,
              libelle: plan.libelle,
              envoiLe: quand.format(plan.envoiLe),
              destinataires: plan.destinataires,
              depasse: plan.depasse,
              dejaProgrammes: plan.dejaProgrammes,
            }))}
          />
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {counts.map((row) => (
          <span
            key={row.status}
            className="border-border bg-surface rounded-lg border px-3 py-1.5 text-sm"
          >
            <LogStatusBadge status={row.status} /> <b className="text-heading">{row._count._all}</b>
          </span>
        ))}
        {counts.length === 0 && (
          <span className="text-text-3 text-sm">Aucun envoi enregistré.</span>
        )}
      </div>

      <h3 className="text-heading mb-3 text-sm font-semibold">Modèles</h3>
      <div className="mb-8 flex flex-col gap-2">
        {templates.map((template) => {
          const declared = templateVariables(template);
          const undeclared = undeclaredVariables({
            bodyFr: template.bodyFr,
            bodyEn: template.bodyEn,
            subjectFr: template.subjectFr,
            subjectEn: template.subjectEn,
            declared,
          });
          return (
            <Link
              key={template.id}
              href={`/admin/notifications/${template.key}`}
              className="border-border bg-surface hover:border-blue-text flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
            >
              <span>
                <b className="text-heading block text-sm">{template.key}</b>
                <span className="text-text-3 text-sm">{template.subjectFr}</span>
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                {declared.map((name) => (
                  <code key={name} className="bg-bg-3 text-text-2 rounded px-1.5 py-0.5 text-xs">
                    {name}
                  </code>
                ))}
                {undeclared.length > 0 && (
                  <span className="bg-warn-soft text-warn-text rounded px-2 py-0.5 text-xs font-semibold">
                    {undeclared.length} variable(s) non déclarée(s)
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </div>

      <h3 className="text-heading mb-3 text-sm font-semibold">25 derniers envois</h3>
      {logs.length === 0 ? (
        <p className="text-text-2 text-sm">Aucun envoi pour le moment.</p>
      ) : (
        <div className="border-border overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-surface text-text-3">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2 text-left font-medium">Destinataire</th>
                <th className="px-3 py-2 text-left font-medium">Modèle</th>
                <th className="px-3 py-2 text-left font-medium">État</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-border border-t">
                  <td className="text-text-3 px-3 py-2 whitespace-nowrap">
                    {log.createdAt.toLocaleString("fr-FR")}
                  </td>
                  <td className="text-heading px-3 py-2">
                    {log.participant.firstName} {log.participant.lastName}
                    <span className="text-text-3"> · {log.to}</span>
                  </td>
                  <td className="text-text-2 px-3 py-2">{log.templateKey}</td>
                  <td className="px-3 py-2">
                    <LogStatusBadge status={log.status} />
                    {log.error && <div className="text-danger-text mt-1 text-xs">{log.error}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
