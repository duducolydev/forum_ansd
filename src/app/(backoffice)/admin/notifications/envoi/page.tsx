import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { getActiveEdition } from "@/lib/edition";
import { listTemplates } from "@/modules/notifications/service";
import { STATUS_LABELS } from "@/modules/participants/components/status-badge";
import { BulkSendForm } from "@/modules/notifications/components/bulk-send-form";

export const dynamic = "force-dynamic";

export default async function BulkSendPage() {
  const session = await auth();
  if (!session?.user || !can(session, "notifications.send_bulk")) {
    redirect("/admin");
  }

  const edition = await getActiveEdition();
  const [templates, categories, countries] = await Promise.all([
    listTemplates(edition.id),
    prisma.participantCategory.findMany({
      where: { editionId: edition.id, isActive: true },
      select: { id: true, labelFr: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.participant.findMany({
      where: { editionId: edition.id, deletedAt: null },
      select: { country: true },
      distinct: ["country"],
      orderBy: { country: "asc" },
    }),
  ]);

  return (
    <div>
      <div className="mb-5">
        <Link href="/admin/notifications" className="text-text-3 text-sm">
          ← Notifications
        </Link>
        <h2 className="mt-1 text-2xl">Envoi groupé</h2>
        <span className="text-text-3 text-sm">
          La population est affichée pour confirmation avant tout envoi.
        </span>
      </div>

      <BulkSendForm
        templates={templates.map((t) => ({ key: t.key, subjectFr: t.subjectFr }))}
        categories={categories}
        statuses={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
        countries={countries.map((row) => row.country)}
      />
    </div>
  );
}
