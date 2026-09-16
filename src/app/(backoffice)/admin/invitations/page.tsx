import { Plus, Upload } from "lucide-react";
import { LienBouton } from "@/components/ui/bouton";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import * as service from "@/modules/invitations/service";
import * as participantsService from "@/modules/participants/service";
import { InvitationStatusBadge } from "@/modules/invitations/components/status-badge";
import { SendButton } from "@/modules/invitations/components/send-button";
import { ReminderForm } from "@/modules/invitations/components/reminder-form";
import { Pagination } from "@/modules/participants/components/pagination";
import { invitationSearchSchema } from "@/modules/invitations/schema";

export default async function InvitationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user || !can(session, "invitations.read")) {
    redirect("/admin");
  }

  const sp = await searchParams;
  const search = invitationSearchSchema.parse(sp);
  const edition = await getActiveEdition();

  const [{ items, total }, categories] = await Promise.all([
    service.listInvitations(edition.id, search),
    participantsService.listCategories(edition.id),
  ]);

  const canSend = can(session, "invitations.send");
  const canWrite = can(session, "invitations.write");

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-2xl">Invitations</h2>
          <span className="text-text-3 text-sm">{total} invitation(s)</span>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <LienBouton href="/admin/invitations/importer" icone={Upload}>
              Importer
            </LienBouton>
            <LienBouton href="/admin/invitations/nouvelle" ton="principal" icone={Plus}>
              Ajouter
            </LienBouton>
          </div>
        )}
      </div>

      {canSend && (
        <div className="border-border bg-surface mb-4 rounded-xl border p-4">
          <ReminderForm categories={categories} />
        </div>
      )}

      <div className="border-border bg-surface overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="border-border bg-surface-2 text-text-3 border-b px-3.5 py-3 text-left text-xs font-semibold">
                Invité(e)
              </th>
              <th className="border-border bg-surface-2 text-text-3 border-b px-3.5 py-3 text-left text-xs font-semibold">
                Catégorie
              </th>
              <th className="border-border bg-surface-2 text-text-3 border-b px-3.5 py-3 text-left text-xs font-semibold">
                Statut
              </th>
              <th className="border-border bg-surface-2 text-text-3 border-b px-3.5 py-3 text-left text-xs font-semibold">
                Relances
              </th>
              <th className="border-border bg-surface-2 border-b px-3.5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((invitation) => (
              <tr key={invitation.id} className="hover:bg-blue-soft">
                <td className="border-border border-b px-3.5 py-3">
                  <b className="text-heading">
                    {invitation.firstName} {invitation.lastName}
                  </b>
                  <div className="text-text-3 text-sm">{invitation.email}</div>
                </td>
                <td className="border-border border-b px-3.5 py-3">
                  {invitation.category.labelFr}
                </td>
                <td className="border-border border-b px-3.5 py-3">
                  <InvitationStatusBadge status={invitation.status} />
                </td>
                <td className="border-border border-b px-3.5 py-3">{invitation.remindersCount}</td>
                <td className="border-border border-b px-3.5 py-3">
                  {canSend && invitation.status !== "REGISTERED" && (
                    <SendButton
                      invitationId={invitation.id}
                      label={invitation.status === "PENDING" ? "Envoyer" : "Renvoyer"}
                    />
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="text-text-3 px-3.5 py-8 text-center">
                  Aucune invitation.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        page={search.page}
        pageSize={search.pageSize}
        total={total}
        basePath="/admin/invitations"
        searchParams={sp}
      />
    </div>
  );
}
