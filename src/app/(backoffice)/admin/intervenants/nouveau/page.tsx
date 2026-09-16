import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { SpeakerForm } from "@/modules/speakers/components/speaker-form";

export const dynamic = "force-dynamic";

export default async function NouvelIntervenantPage() {
  const session = await auth();
  if (!session?.user) redirect("/connexion");
  if (!can(session, "speakers.write")) redirect("/admin/intervenants");

  return (
    <div>
      <Link href="/admin/intervenants" className="text-text-3 text-sm">
        Intervenants
      </Link>
      <h2 className="mt-2 mb-5 text-2xl">Nouvel intervenant</h2>
      <SpeakerForm
        valeurs={{
          firstName: "",
          lastName: "",
          email: "",
          jobTitle: "",
          organization: "",
          country: "",
          bioFr: "",
          bioEn: "",
          isPublished: false,
        }}
      />
    </div>
  );
}
