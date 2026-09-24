import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { findReferentById } from "@/modules/referents/service";
import { updateReferentAction } from "@/modules/referents/actions";
import { ReferentForm } from "@/modules/referents/components/referent-form";
import { SupprimerReferent } from "@/modules/referents/components/supprimer-referent";

export default async function ModifierReferentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user || !can(session, "delegations.write")) {
    redirect("/admin/referents");
  }

  const { id } = await params;
  const referent = await findReferentById(id);
  if (!referent) notFound();

  const boundAction = updateReferentAction.bind(null, referent.id);

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-5 text-2xl">Modifier {referent.name}</h2>

      <div className="border-border bg-surface rounded-xl border p-6">
        <ReferentForm
          action={boundAction}
          submitLabel="Enregistrer"
          defaultValues={{
            name: referent.name,
            email: referent.email,
            phone: referent.phone ?? undefined,
            role: referent.role ?? undefined,
            isActive: referent.isActive,
          }}
        />
      </div>

      {/*
        Les délégations accompagnées sont listées ici et non sur une page à
        part : c'est la question qu'on se pose en ouvrant une fiche, avant de
        la retirer du service ou de la supprimer.
      */}
      <div className="border-border bg-surface mt-5 rounded-xl border p-6">
        <h3 className="mb-3 text-lg">Délégations accompagnées</h3>
        {referent.delegations.length === 0 ? (
          <p className="text-text-3 text-sm">
            Aucune pour l&apos;instant. Le rattachement se fait depuis la fiche d&apos;une
            délégation.
          </p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {referent.delegations.map((delegation) => (
              <li key={delegation.id}>
                <Link href={`/admin/delegations/${delegation.id}`} className="text-link underline">
                  {delegation.name}
                </Link>
                <span className="text-text-3"> — {delegation._count.members} membre(s)</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-border bg-surface mt-5 rounded-xl border p-6">
        <h3 className="mb-1 text-lg">Retirer cette fiche</h3>
        <p className="text-text-2 mb-3 text-sm">
          Un référent qui quitte le comité se <strong>désactive</strong> plutôt qu&apos;il ne se
          supprime : les délégations qu&apos;il a accompagnées gardent alors la trace de qui les
          suivait. La suppression n&apos;est possible que si plus aucune délégation ne lui est
          rattachée.
        </p>
        <SupprimerReferent referentId={referent.id} nom={referent.name} />
      </div>
    </div>
  );
}
