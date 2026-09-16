import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getSpeaker, sessionsPourRattachement } from "@/modules/speakers/service";
import { SpeakerForm } from "@/modules/speakers/components/speaker-form";
import { SessionsIntervenant } from "@/modules/speakers/components/sessions-intervenant";

export const dynamic = "force-dynamic";

const quand = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export default async function ModifierIntervenantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/connexion");
  if (!can(session, "speakers.write")) redirect("/admin/intervenants");

  const { id } = await params;
  const speaker = await getSpeaker(id);
  if (!speaker) notFound();

  const sessions = await sessionsPourRattachement(speaker.editionId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/intervenants" className="text-text-3 text-sm">
          Intervenants
        </Link>
        <h2 className="mt-2 text-2xl">
          {speaker.firstName} {speaker.lastName}
        </h2>
        <p className="text-text-3 text-sm">
          {speaker.isPublished ? "Publié" : "Brouillon"}
          {speaker.photoPath ? " · photo déposée" : ""}
          {speaker.presentationPath ? " · présentation déposée" : ""}
        </p>
      </div>

      <SessionsIntervenant
        speakerId={speaker.id}
        aPresentation={Boolean(speaker.presentationPath)}
        rattachements={speaker.sessions.map((lien) => ({
          sessionId: lien.session.id,
          titre: lien.session.titleFr,
          quand: quand.format(lien.session.startTime),
          role: lien.role,
          statut: lien.confirmationStatus,
        }))}
        sessions={sessions.map((item) => ({
          id: item.id,
          titre: item.titleFr,
          quand: quand.format(item.startTime),
        }))}
      />

      <SpeakerForm
        valeurs={{
          id: speaker.id,
          firstName: speaker.firstName,
          lastName: speaker.lastName,
          email: speaker.email ?? "",
          jobTitle: speaker.jobTitle ?? "",
          organization: speaker.organization ?? "",
          country: speaker.country ?? "",
          bioFr: speaker.bioFr ?? "",
          bioEn: speaker.bioEn ?? "",
          isPublished: speaker.isPublished,
        }}
      />
    </div>
  );
}
