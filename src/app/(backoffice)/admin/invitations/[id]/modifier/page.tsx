import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { listCategories } from "@/modules/participants/service";
import { getInvitationById } from "@/modules/invitations/service";
import { updateInvitationAction } from "@/modules/invitations/actions";
import { InvitationForm } from "@/modules/invitations/components/invitation-form";
import { SupprimerInvitation } from "@/modules/invitations/components/supprimer-invitation";
import { InvitationStatusBadge } from "@/modules/invitations/components/status-badge";

export default async function ModifierInvitationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user || !can(session, "invitations.write")) {
    redirect("/admin/invitations");
  }

  const { id } = await params;
  const invitation = await getInvitationById(id);
  if (!invitation) notFound();

  const nom = `${invitation.firstName} ${invitation.lastName}`;
  const dejaEnvoyee = invitation.status !== "PENDING";

  // Acceptée : la fiche du participant fait foi, c'est elle qu'on corrige.
  if (invitation.participant) {
    return (
      <div className="mx-auto max-w-2xl">
        <h2 className="mb-5 text-2xl">Invitation de {nom}</h2>
        <div className="border-border bg-surface rounded-xl border p-6">
          <p className="text-text-2 text-sm">
            Cette invitation a été acceptée et ne se modifie plus. Les corrections se font sur{" "}
            <Link
              href={`/admin/participants/${invitation.participant.id}`}
              className="text-link underline"
            >
              la fiche du participant
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  const categories = await listCategories(invitation.editionId);
  const boundAction = updateInvitationAction.bind(null, invitation.id);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center gap-3">
        <h2 className="text-2xl">Modifier l&apos;invitation de {nom}</h2>
        <InvitationStatusBadge status={invitation.status} />
      </div>

      <div className="border-border bg-surface rounded-xl border p-6">
        {dejaEnvoyee && (
          <p className="text-text-2 mb-4 text-sm">
            Cette invitation est déjà partie. Corriger le nom, la structure ou la catégorie ne
            change pas le lien reçu. Changer l&apos;adresse, en revanche, invalide ce lien :
            l&apos;invitation repasse « À envoyer ».
          </p>
        )}
        <InvitationForm
          categories={categories}
          action={boundAction}
          dejaEnvoyee={dejaEnvoyee}
          defaultValues={{
            email: invitation.email,
            firstName: invitation.firstName,
            lastName: invitation.lastName,
            organization: invitation.organization ?? undefined,
            country: invitation.country ?? undefined,
            categoryId: invitation.categoryId,
          }}
        />
      </div>

      <div className="border-border bg-surface mt-5 rounded-xl border p-6">
        <h3 className="mb-1 text-lg">Supprimer cette invitation</h3>
        <p className="text-text-2 mb-3 text-sm">
          Pour une invitation créée par erreur, en double ou pour la mauvaise personne.
        </p>
        <SupprimerInvitation invitationId={invitation.id} nom={nom} dejaEnvoyee={dejaEnvoyee} />
      </div>
    </div>
  );
}
