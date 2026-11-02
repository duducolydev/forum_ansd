import { avecCivilite } from "@/lib/civilite";
import { ArrowUpRight, Plus } from "lucide-react";
import { LienBouton } from "@/components/ui/bouton";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { listDelegations } from "@/modules/participants/delegation-service";
import {
  delegationSearchSchema,
  filtrerDelegations,
} from "@/modules/participants/filtre-delegations";
import { DelegationsToolbar } from "@/modules/participants/components/delegations-toolbar";
import { SupprimerDelegation } from "@/modules/participants/components/supprimer-delegation";

export default async function DelegationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user || !can(session, "delegations.read")) {
    redirect("/admin");
  }

  const recherche = delegationSearchSchema.safeParse(await searchParams);
  const edition = await getActiveEdition();
  const toutes = await listDelegations(edition.id);
  const delegations = filtrerDelegations(toutes, recherche.success ? recherche.data : {});
  const filtre = delegations.length !== toutes.length;
  const canWrite = can(session, "delegations.write");

  // Options des filtres tirées des délégations elles-mêmes : on ne propose
  // que des pays et des référents qui donnent au moins un résultat.
  const countries = [
    ...new Set(toutes.map((d) => d.country?.trim()).filter((c): c is string => Boolean(c))),
  ].sort((a, b) => a.localeCompare(b, "fr"));
  const referents = [
    ...new Map(
      toutes.flatMap((d) => (d.referent ? [[d.referent.id, d.referent] as const] : [])),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name, "fr"));

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-2xl">Délégations</h2>
          <span className="text-text-3 text-sm">
            {filtre
              ? `${delegations.length} délégation(s) sur ${toutes.length}`
              : `${toutes.length} délégation(s)`}
          </span>
        </div>
        {canWrite && (
          <LienBouton href="/admin/delegations/nouvelle" ton="principal" icone={Plus}>
            Ajouter
          </LienBouton>
        )}
      </div>

      <DelegationsToolbar countries={countries} referents={referents} />

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
                    ? avecCivilite(
                        delegation.headParticipant.civility,
                        `${delegation.headParticipant.firstName} ${delegation.headParticipant.lastName}`,
                      )
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
                  <div className="flex items-start justify-end gap-2">
                    <LienBouton
                      href={`/admin/delegations/${delegation.id}`}
                      ton="discret"
                      taille="petit"
                      icone={ArrowUpRight}
                    >
                      Ouvrir
                    </LienBouton>
                    {canWrite && (
                      <SupprimerDelegation
                        delegationId={delegation.id}
                        nom={delegation.name}
                        membres={delegation._count.members}
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {delegations.length === 0 && (
              <tr>
                <td colSpan={6} className="text-text-3 px-3.5 py-8 text-center">
                  {filtre ? "Aucune délégation ne correspond aux filtres." : "Aucune délégation."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
