import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { ImportWizard } from "@/modules/invitations/components/import-wizard";

export default async function ImportInvitationsPage() {
  const session = await auth();
  if (!session?.user || !can(session, "invitations.write")) {
    redirect("/admin/invitations");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-2xl">Importer des invitations</h2>
        <a
          href="/api/v1/invitations/template"
          className="border-border text-heading rounded-lg border px-4 py-2 text-sm font-semibold"
        >
          Télécharger le modèle
        </a>
      </div>
      <div className="border-border bg-surface rounded-xl border p-6">
        <ImportWizard />
      </div>
    </div>
  );
}
