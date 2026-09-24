import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { creerNewsletterAction } from "@/modules/newsletters/actions";
import { FormulaireNewsletter } from "@/modules/newsletters/components/formulaire-newsletter";

export const metadata = { title: "Rédiger une newsletter" };

export default async function NouvelleNewsletterPage() {
  const session = await auth();
  if (!session?.user || !can(session, "content.write")) {
    redirect("/admin/newsletters");
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h2 className="mb-5 text-2xl">Rédiger une newsletter</h2>
      <div className="border-border bg-surface rounded-xl border p-6">
        <FormulaireNewsletter action={creerNewsletterAction} submitLabel="Créer la newsletter" />
      </div>
    </div>
  );
}
