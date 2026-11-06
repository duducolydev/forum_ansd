import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { inventairePays } from "@/modules/settings/pays-service";
import { HarmonisationPays } from "@/modules/settings/components/harmonisation-pays";

export const metadata = { title: "Harmonisation des pays" };

/** Toujours relue : la page montre l'état de la base au moment où on l'ouvre. */
export const dynamic = "force-dynamic";

/**
 * Harmonisation des pays (6 novembre 2026).
 *
 * Les formulaires proposent désormais une liste de pays ; cette page ramène à
 * cette liste les valeurs saisies librement avant. Réservée à
 * `settings.write` : un remplacement touche d'un coup toutes les fiches qui
 * portent la valeur.
 */
export default async function PaysPage() {
  const session = await auth();
  if (!session?.user || !can(session, "settings.write")) {
    redirect("/admin");
  }

  const { aHarmoniser, conformes } = await inventairePays();
  const fiches = aHarmoniser.reduce((somme, ligne) => somme + ligne.total, 0);
  const reconnues = aHarmoniser.filter((ligne) => ligne.proposition).length;

  return (
    <div>
      <div className="mb-5">
        <Link href="/admin/parametres" className="text-link text-sm">
          ← Paramètres
        </Link>
        <h2 className="mt-1 text-2xl">Harmonisation des pays</h2>
        <p className="text-text-3 mt-1 max-w-3xl text-sm">
          Le pays se choisit désormais dans une liste. Les valeurs saisies librement auparavant («
          Senegal », « SN », « Sn »…) sont listées ici : vérifiez le pays proposé, corrigez-le si
          besoin, puis harmonisez. Participants, intervenants, invitations et délégations sont mis à
          jour ensemble.
        </p>
        <p className="text-text-2 mt-2 text-sm">
          {conformes} fiche{conformes > 1 ? "s" : ""} déjà conforme{conformes > 1 ? "s" : ""}
          {aHarmoniser.length > 0 && (
            <>
              {" · "}
              <b className="text-heading">
                {aHarmoniser.length} valeur{aHarmoniser.length > 1 ? "s" : ""} à harmoniser
              </b>{" "}
              ({fiches} fiche{fiches > 1 ? "s" : ""}), dont {reconnues} reconnue
              {reconnues > 1 ? "s" : ""} automatiquement
            </>
          )}
          .
        </p>
      </div>

      <HarmonisationPays valeurs={aHarmoniser} />
    </div>
  );
}
