import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { createReferentAction } from "@/modules/referents/actions";
import { ReferentForm } from "@/modules/referents/components/referent-form";

export default async function NouveauReferentPage() {
  const session = await auth();
  if (!session?.user || !can(session, "delegations.write")) {
    redirect("/admin/referents");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-5 text-2xl">Ajouter un référent</h2>
      <div className="border-border bg-surface rounded-xl border p-6">
        <ReferentForm action={createReferentAction} submitLabel="Créer le référent" />
      </div>
    </div>
  );
}
