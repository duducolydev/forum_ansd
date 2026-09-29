import Link from "next/link";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { LienExterne } from "@/components/ui/bouton";
import { ImportParticipants } from "@/modules/participants/components/import-participants";

export const metadata = { title: "Importer des participants" };

/**
 * Import de participants par fichier (29 septembre 2026) : pour les personnes
 * invitées hors du site qui ont déjà confirmé leur venue.
 */
export default async function ImporterParticipantsPage() {
  const session = await auth();
  if (!session?.user || !can(session, "participants.import")) {
    redirect("/admin/participants");
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/admin/participants" className="text-link text-sm">
        ← Participants
      </Link>
      <div className="mt-1 mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl">Importer des participants</h2>
          <p className="text-text-3 mt-1 max-w-[70ch] text-sm">
            Pour les personnes invitées hors du site (invitation papier, courrier officiel) qui ont
            déjà confirmé leur venue : elles sont inscrites sans démarche de leur part, et reçoivent
            un accès direct à leur espace.
          </p>
        </div>
        <LienExterne href="/api/v1/participants/modele-import" icone={Download}>
          Télécharger le modèle
        </LienExterne>
      </div>
      <div className="border-border bg-surface rounded-xl border p-6">
        <ImportParticipants />
      </div>
    </div>
  );
}
