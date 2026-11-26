import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { FormulaireNewsletter } from "@/modules/newsletters/components/formulaire-newsletter";

export const metadata = { title: "Nouvelle newsletter" };

export default async function NouvelleNewsletterPage() {
  const session = await auth();
  if (!session?.user || !can(session, "content.write")) {
    redirect("/admin/newsletters");
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/admin/newsletters" className="text-link text-sm">
        ← Newsletters
      </Link>
      <h2 className="mt-1 mb-1 text-2xl">Nouvelle newsletter</h2>
      <p className="text-text-3 mb-5 text-sm">
        Un titre, une description et le fichier de synthèse en PDF. La publication et l&apos;envoi
        se font ensuite, depuis la fiche.
      </p>
      <div className="border-border bg-surface rounded-xl border p-6">
        <FormulaireNewsletter />
      </div>
    </div>
  );
}
