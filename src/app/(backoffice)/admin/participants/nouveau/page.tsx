import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import * as service from "@/modules/participants/service";
import { createParticipantAction } from "@/modules/participants/actions";
import { ParticipantForm } from "@/modules/participants/components/participant-form";

export default async function NewParticipantPage() {
  const session = await auth();
  if (!session?.user || !can(session, "participants.write")) {
    redirect("/admin/participants");
  }

  const edition = await getActiveEdition();
  const [categories, delegations] = await Promise.all([
    service.listCategories(edition.id),
    service.listDelegationsForSelect(edition.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-5 text-2xl">Ajouter un participant</h2>
      <div className="border-border bg-surface rounded-xl border p-6">
        <ParticipantForm
          action={createParticipantAction}
          categories={categories}
          delegations={delegations}
          submitLabel="Créer le participant"
        />
      </div>
    </div>
  );
}
