import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getSession } from "@/modules/sessions/service";
import {
  comptesRapporteurs,
  consentementsDesIntervenants,
  listerParSession,
  niveauPour,
  rapporteursDeSession,
} from "@/modules/contributions/service";
import {
  GestionContributions,
  RapporteursSession,
} from "@/modules/contributions/components/gestion-contributions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Contributions de la session" };

const jourLong = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

export default async function ContributionsSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/connexion");

  const { id } = await params;
  const acteur = { userId: session.user.id, permissions: session.user.permissions ?? [] };

  /*
   * Le niveau se décide par session : un rapporteur ouvre les siennes, et se
   * voit refuser les autres **avec la raison**, plutôt qu'une 404 qui lui
   * ferait croire à un lien cassé.
   */
  const niveau = await niveauPour(acteur, id);
  if (niveau === "aucun") {
    return (
      <div className="border-border bg-surface text-text-2 rounded-xl border p-5">
        {can(session, "contributions.draft") ? (
          <>
            Cette session ne vous est pas confiée.{" "}
            <Link href="/admin/contributions" className="text-link font-semibold underline">
              Voir vos sessions
            </Link>
          </>
        ) : (
          "Votre rôle ne permet pas de gérer les contributions."
        )}
      </div>
    );
  }

  const [courante, contributions] = await Promise.all([getSession(id), listerParSession(id)]);
  if (!courante) notFound();

  const [consentements, rapporteurs] = await Promise.all([
    consentementsDesIntervenants(contributions),
    niveau === "complet"
      ? Promise.all([rapporteursDeSession(id), comptesRapporteurs()])
      : Promise.resolve(null),
  ]);

  /*
   * Les intervenants proposés sont ceux de la session, et seulement eux : une
   * contribution s'attribue à qui a parlé dans cette séance. Une liste de tous
   * les intervenants du Forum inviterait à l'erreur.
   */
  const intervenants = courante.speakers.map((lien) => ({
    id: lien.speaker.id,
    nom: `${lien.speaker.firstName} ${lien.speaker.lastName}`,
  }));

  const publiees = contributions.filter((contribution) => contribution.isPublished).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/contributions" className="text-text-3 text-sm">
          Contributions
        </Link>
        <h2 className="mt-2 text-2xl">{courante.titleFr}</h2>
        <p className="text-text-3 text-sm">
          {jourLong.format(courante.day)} · {contributions.length} contribution
          {contributions.length > 1 ? "s" : ""}, dont {publiees} publiée
          {publiees > 1 ? "s" : ""}
        </p>
        {niveau === "rapporteur" && (
          <p className="text-text-2 mt-2 text-sm">
            Vous êtes rapporteur de cette session : vous rédigez, le gestionnaire programme publie.
          </p>
        )}
      </div>

      {rapporteurs && (
        <RapporteursSession
          sessionId={id}
          rattaches={rapporteurs[0]}
          disponibles={rapporteurs[1]}
        />
      )}

      <GestionContributions
        sessionId={id}
        contributions={contributions}
        intervenants={intervenants}
        niveau={niveau}
        consentements={consentements}
      />
    </div>
  );
}
