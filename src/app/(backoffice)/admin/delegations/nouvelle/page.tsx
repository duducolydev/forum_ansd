import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { createDelegationAction } from "@/modules/participants/actions";
import { DelegationForm } from "@/modules/participants/components/delegation-form";
import { listReferentsActifs } from "@/modules/referents/service";

export default async function NewDelegationPage() {
  const session = await auth();
  if (!session?.user || !can(session, "delegations.write")) {
    redirect("/admin/delegations");
  }

  const edition = await getActiveEdition();
  const referents = await listReferentsActifs(edition.id);

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-5 text-2xl">Ajouter une délégation</h2>
      <div className="border-border bg-surface rounded-xl border p-6">
        <DelegationForm
          action={createDelegationAction}
          submitLabel="Créer la délégation"
          referents={referents}
        />
      </div>
    </div>
  );
}
