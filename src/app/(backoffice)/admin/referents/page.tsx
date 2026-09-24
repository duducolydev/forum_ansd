import { redirect } from "next/navigation";
import { ArrowUpRight, Plus } from "lucide-react";
import { LienBouton } from "@/components/ui/bouton";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { listReferents } from "@/modules/referents/service";

const TH =
  "border-border bg-surface-2 text-text-3 border-b px-3.5 py-3 text-left text-xs font-semibold";
const TD = "border-border border-b px-3.5 py-3";

/**
 * Annuaire des référents internes (§28).
 *
 * La colonne « Délégations » n'est pas décorative : c'est elle qui dit si une
 * fiche peut être supprimée, et qui rend visible un référent qu'on a créé puis
 * oublié de rattacher.
 */
export default async function ReferentsPage() {
  const session = await auth();
  if (!session?.user || !can(session, "delegations.read")) {
    redirect("/admin");
  }

  const edition = await getActiveEdition();
  const referents = await listReferents(edition.id);
  const enService = referents.filter((r) => r.isActive).length;

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-2xl">Référents</h2>
          <span className="text-text-3 text-sm">
            {referents.length} fiche(s), dont {enService} en service
          </span>
        </div>
        {can(session, "delegations.write") && (
          <LienBouton href="/admin/referents/nouveau" ton="principal" icone={Plus}>
            Ajouter
          </LienBouton>
        )}
      </div>

      <p className="text-text-2 mb-5 max-w-[80ch] text-sm">
        Un référent accompagne une ou plusieurs délégations. Ses coordonnées sont communiquées aux
        participants concernés, et il reçoit une alerte à sa désignation puis à chaque nouveau
        membre.
      </p>

      <div className="border-border bg-surface overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={TH}>Nom</th>
              <th className={TH}>Fonction</th>
              <th className={TH}>E-mail</th>
              <th className={TH}>Téléphone</th>
              <th className={TH}>Délégations</th>
              <th className={TH}>État</th>
              <th className="border-border bg-surface-2 border-b px-3.5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {referents.map((referent) => (
              <tr key={referent.id} className="hover:bg-blue-soft">
                <td className={`${TD} text-heading font-semibold`}>{referent.name}</td>
                <td className={TD}>{referent.role ?? "—"}</td>
                <td className={TD}>{referent.email}</td>
                <td className={TD}>{referent.phone ?? "—"}</td>
                <td className={TD}>{referent._count.delegations}</td>
                <td className={TD}>
                  {referent.isActive ? (
                    <span className="text-accent-text">En service</span>
                  ) : (
                    <span className="text-text-3">Retiré</span>
                  )}
                </td>
                <td className={TD}>
                  <LienBouton
                    href={`/admin/referents/${referent.id}/modifier`}
                    ton="discret"
                    taille="petit"
                    icone={ArrowUpRight}
                  >
                    Ouvrir
                  </LienBouton>
                </td>
              </tr>
            ))}
            {referents.length === 0 && (
              <tr>
                <td colSpan={7} className="text-text-3 px-3.5 py-8 text-center">
                  Aucun référent. Créez-en un avant de le rattacher à une délégation.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
