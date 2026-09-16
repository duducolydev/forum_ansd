import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import * as service from "@/modules/sponsors/service";
import { FormulaireSponsor } from "@/modules/sponsors/components/formulaire-sponsor";

export const metadata = { title: "Nouveau sponsor" };

export default async function NouveauSponsorPage() {
  const session = await auth();
  if (!session?.user || !can(session, "sponsors.write")) {
    redirect("/admin");
  }

  const edition = await getActiveEdition();
  const niveaux = await service.listerNiveaux(edition.id);

  if (niveaux.length === 0) {
    // Sans niveau, le formulaire n'aurait aucune valeur à proposer pour un
    // champ obligatoire : on renvoie là où le problème se règle.
    redirect("/admin/sponsors/niveaux");
  }

  return (
    <div>
      <div className="mb-5">
        <Link href="/admin/sponsors" className="text-link text-sm">
          ← Sponsors
        </Link>
        <h2 className="mt-1 text-2xl">Nouveau sponsor</h2>
        <span className="text-text-3 text-sm">Le logo se téléverse une fois la fiche créée.</span>
      </div>

      <FormulaireSponsor niveaux={niveaux.map(({ id, name }) => ({ id, name }))} />
    </div>
  );
}
