import { ArrowUpRight, Plus } from "lucide-react";
import { LienBouton } from "@/components/ui/bouton";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { listDelegations } from "@/modules/participants/delegation-service";

export default async function DelegationsPage() {
  const session = await auth();
  if (!session?.user || !can(session, "delegations.read")) {
    redirect("/admin");
  }

  const edition = await getActiveEdition();
  const delegations = await listDelegations(edition.id);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-2xl">Délégations</h2>
          <span className="text-text-3 text-sm">{delegations.length} délégation(s)</span>
        </div>
        {can(session, "delegations.write") && (
          <LienBouton href="/admin/delegations/nouvelle" ton="principal" icone={Plus}>
            Ajouter
          </LienBouton>
        )}
      </div>

      <div className="border-border bg-surface overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="border-border bg-surface-2 text-text-3 border-b px-3.5 py-3 text-left text-xs font-semibold">
                Nom
              </th>
              <th className="border-border bg-surface-2 text-text-3 border-b px-3.5 py-3 text-left text-xs font-semibold">
                Pays
              </th>
              <th className="border-border bg-surface-2 text-text-3 border-b px-3.5 py-3 text-left text-xs font-semibold">
                Chef de délégation
              </th>
              <th className="border-border bg-surface-2 text-text-3 border-b px-3.5 py-3 text-left text-xs font-semibold">
                Référent
              </th>
              <th className="border-border bg-surface-2 text-text-3 border-b px-3.5 py-3 text-left text-xs font-semibold">
                Membres
              </th>
              <th className="border-border bg-surface-2 border-b px-3.5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {delegations.map((delegation) => (
              <tr key={delegation.id} className="hover:bg-blue-soft">
                <td className="border-border text-heading border-b px-3.5 py-3 font-semibold">
                  {delegation.name}
                </td>
                <td className="border-border border-b px-3.5 py-3">{delegation.country ?? "—"}</td>
                <td className="border-border border-b px-3.5 py-3">
                  {delegation.headParticipant
                    ? `${delegation.headParticipant.firstName} ${delegation.headParticipant.lastName}`
                    : "—"}
                </td>
                <td className="border-border border-b px-3.5 py-3">
                  {delegation.referent?.name ?? "—"}
                </td>
                <td className="border-border border-b px-3.5 py-3">
                  {delegation._count.members}
                  {delegation.maxMembers ? ` / ${delegation.maxMembers}` : ""}
                </td>
                <td className="border-border border-b px-3.5 py-3">
                  <LienBouton
                    href={`/admin/delegations/${delegation.id}`}
                    ton="discret"
                    taille="petit"
                    icone={ArrowUpRight}
                  >
                    Ouvrir
                  </LienBouton>
                </td>
              </tr>
            ))}
            {delegations.length === 0 && (
              <tr>
                <td colSpan={6} className="text-text-3 px-3.5 py-8 text-center">
                  Aucune délégation.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
