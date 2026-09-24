import { Pencil } from "lucide-react";
import { LienBouton } from "@/components/ui/bouton";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getDelegation } from "@/modules/participants/delegation-service";
import { StatusBadge } from "@/modules/participants/components/status-badge";
import { SetHeadButton } from "@/modules/participants/components/set-head-button";

export default async function DelegationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user || !can(session, "delegations.read")) {
    redirect("/admin");
  }

  const { id } = await params;
  const delegation = await getDelegation(id);
  if (!delegation) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h2 className="text-2xl">{delegation.name}</h2>
          <span className="text-text-3 text-sm">
            {delegation.country ?? "—"} · {delegation.institution ?? "—"}
          </span>
        </div>
        {can(session, "delegations.write") && (
          <LienBouton href={`/admin/delegations/${delegation.id}/modifier`} icone={Pencil}>
            Modifier
          </LienBouton>
        )}
      </div>

      {/*
        Référent avant la liste des membres : c'est l'information qu'on vient
        vérifier en ouvrant une délégation, et son absence est elle-même un
        renseignement — d'où l'encart affiché même vide, plutôt que masqué.
      */}
      <div className="border-border bg-surface mb-5 rounded-xl border p-5">
        <h3 className="text-heading mb-3 text-sm font-semibold">Référent</h3>
        {delegation.referent ? (
          <div className="text-sm">
            <p className="text-heading font-semibold">
              {delegation.referent.name}
              {delegation.referent.role && (
                <span className="text-text-3 font-normal"> — {delegation.referent.role}</span>
              )}
            </p>
            <p className="text-text-2 mt-1">
              {delegation.referent.email}
              {delegation.referent.phone && ` · ${delegation.referent.phone}`}
            </p>
          </div>
        ) : (
          <p className="text-text-3 text-sm">
            Aucun référent désigné. Les membres de cette délégation n&apos;ont personne à
            joindre&nbsp;: rattachez-en un depuis « Modifier ».
          </p>
        )}
      </div>

      <div className="border-border bg-surface rounded-xl border p-5">
        <h3 className="text-heading mb-3 text-sm font-semibold">
          Membres ({delegation.members.length}
          {delegation.maxMembers ? ` / ${delegation.maxMembers}` : ""})
        </h3>
        <ul className="divide-border flex flex-col divide-y">
          {delegation.members.map((member) => (
            <li key={member.id} className="flex items-center justify-between py-2.5 text-sm">
              <div>
                <Link
                  href={`/admin/participants/${member.id}`}
                  className="text-heading font-semibold"
                >
                  {member.firstName} {member.lastName}
                </Link>
                <span className="text-text-3 ml-2">{member.publicId}</span>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={member.status} />
                {can(session, "delegations.write") && (
                  <SetHeadButton
                    delegationId={delegation.id}
                    participantId={member.id}
                    isHead={delegation.headParticipant?.id === member.id}
                  />
                )}
              </div>
            </li>
          ))}
          {delegation.members.length === 0 && (
            <li className="text-text-3 py-4 text-center">Aucun membre pour l&apos;instant.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
