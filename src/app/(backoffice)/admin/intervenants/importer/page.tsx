import Link from "next/link";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { LienExterne } from "@/components/ui/bouton";
import { ImportIntervenants } from "@/modules/speakers/components/import-intervenants";

export const metadata = { title: "Importer des intervenants" };

/**
 * Import d'intervenants par fichier (20 octobre 2026) : panélistes,
 * modérateurs et orateurs du programme, chargés d'un coup plutôt que fiche
 * par fiche.
 */
export default async function ImporterIntervenantsPage() {
  const session = await auth();
  if (!session?.user) redirect("/connexion");
  if (!can(session, "speakers.write")) redirect("/admin/intervenants");

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/admin/intervenants" className="text-link text-sm">
        ← Intervenants
      </Link>
      <div className="mt-1 mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl">Importer des intervenants</h2>
          <p className="text-text-3 mt-1 max-w-[70ch] text-sm">
            Pour charger d&apos;un coup les panélistes, modérateurs et orateurs du programme : une
            fiche par ligne, rattachée au besoin à ses séances. Les intervenants déjà enregistrés
            sont écartés, jamais modifiés.
          </p>
        </div>
        <LienExterne href="/api/v1/speakers/modele-import" icone={Download}>
          Télécharger le modèle
        </LienExterne>
      </div>
      <div className="border-border bg-surface rounded-xl border p-6">
        <ImportIntervenants />
      </div>
    </div>
  );
}
