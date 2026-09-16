import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import * as service from "@/modules/participants/service";
import { updateParticipantAction } from "@/modules/participants/actions";
import { ParticipantForm } from "@/modules/participants/components/participant-form";

export default async function EditParticipantPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !can(session, "participants.write")) {
    redirect("/admin/participants");
  }

  const { id } = await params;
  const participant = await service.getParticipant(id);
  if (!participant) notFound();

  const edition = await getActiveEdition();
  const [categories, delegations] = await Promise.all([
    service.listCategories(edition.id),
    service.listDelegationsForSelect(edition.id),
  ]);

  const boundAction = updateParticipantAction.bind(null, participant.id);

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-5 text-2xl">
        Modifier {participant.firstName} {participant.lastName}
      </h2>
      <div className="border-border bg-surface rounded-xl border p-6">
        <ParticipantForm
          action={boundAction}
          categories={categories}
          delegations={delegations}
          submitLabel="Enregistrer"
          defaultValues={{
            civility: participant.civility ?? undefined,
            firstName: participant.firstName,
            lastName: participant.lastName,
            email: participant.email,
            phone: participant.phone ?? undefined,
            organization: participant.organization ?? undefined,
            organizationType: participant.organizationType ?? undefined,
            jobTitle: participant.jobTitle ?? undefined,
            country: participant.country,
            city: participant.city ?? undefined,
            categoryId: participant.categoryId,
            delegationId: participant.delegationId ?? undefined,
            notes: participant.notes ?? undefined,
          }}
        />
      </div>
    </div>
  );
}
