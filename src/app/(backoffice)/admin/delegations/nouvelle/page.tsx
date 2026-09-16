import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { createDelegationAction } from "@/modules/participants/actions";
import { DelegationForm } from "@/modules/participants/components/delegation-form";

export default async function NewDelegationPage() {
  const session = await auth();
  if (!session?.user || !can(session, "delegations.write")) {
    redirect("/admin/delegations");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-5 text-2xl">Ajouter une délégation</h2>
      <div className="border-border bg-surface rounded-xl border p-6">
        <DelegationForm action={createDelegationAction} submitLabel="Créer la délégation" />
      </div>
    </div>
  );
}
