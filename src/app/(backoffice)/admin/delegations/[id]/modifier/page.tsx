import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getDelegation } from "@/modules/participants/delegation-service";
import { updateDelegationAction } from "@/modules/participants/actions";
import { DelegationForm } from "@/modules/participants/components/delegation-form";

export default async function EditDelegationPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !can(session, "delegations.write")) {
    redirect("/admin/delegations");
  }

  const { id } = await params;
  const delegation = await getDelegation(id);
  if (!delegation) notFound();

  const boundAction = updateDelegationAction.bind(null, delegation.id);

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-5 text-2xl">Modifier {delegation.name}</h2>
      <div className="border-border bg-surface rounded-xl border p-6">
        <DelegationForm
          action={boundAction}
          submitLabel="Enregistrer"
          defaultValues={{
            name: delegation.name,
            country: delegation.country ?? undefined,
            institution: delegation.institution ?? undefined,
            maxMembers: delegation.maxMembers ?? undefined,
          }}
        />
      </div>
    </div>
  );
}
