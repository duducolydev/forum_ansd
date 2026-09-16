import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { listCategories } from "@/modules/participants/service";
import { InvitationForm } from "@/modules/invitations/components/invitation-form";

export default async function NewInvitationPage() {
  const session = await auth();
  if (!session?.user || !can(session, "invitations.write")) {
    redirect("/admin/invitations");
  }

  const edition = await getActiveEdition();
  const categories = await listCategories(edition.id);

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-5 text-2xl">Nouvelle invitation</h2>
      <div className="border-border bg-surface rounded-xl border p-6">
        <InvitationForm categories={categories} />
      </div>
    </div>
  );
}
