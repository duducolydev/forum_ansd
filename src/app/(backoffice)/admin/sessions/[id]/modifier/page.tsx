import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { getSession, listRooms } from "@/modules/sessions/service";
import { SessionForm } from "@/modules/sessions/components/session-form";
import { TdrForm } from "@/modules/sessions/components/tdr-form";

export const dynamic = "force-dynamic";

function heureIso(date: Date): string {
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

export default async function ModifierSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/connexion");
  if (!can(session, "sessions.write")) redirect("/admin/sessions");

  const { id } = await params;
  const edition = await getActiveEdition();
  const [courante, salles] = await Promise.all([getSession(id), listRooms(edition.id)]);

  if (!courante) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/sessions" className="text-text-3 text-sm">
          Programme
        </Link>
        <h2 className="mt-2 text-2xl">{courante.titleFr}</h2>
        <p className="text-text-3 text-sm">
          {courante.isPublished ? "Publiée" : "Brouillon"} ·{" "}
          <Link href={`/programme/${courante.slug}`} className="underline">
            voir la fiche publique
          </Link>
        </p>
      </div>

      <SessionForm
        salles={salles.map((salle) => ({
          id: salle.id,
          name: salle.name,
          capacity: salle.capacity,
        }))}
        valeurs={{
          id: courante.id,
          slug: courante.slug,
          type: courante.type,
          number: courante.number,
          titleFr: courante.titleFr,
          titleEn: courante.titleEn,
          descriptionFr: courante.descriptionFr ?? "",
          descriptionEn: courante.descriptionEn ?? "",
          objectives: courante.objectives ?? "",
          theme: courante.theme ?? "",
          day: courante.day.toISOString().slice(0, 10),
          startTime: heureIso(courante.startTime),
          endTime: heureIso(courante.endTime),
          roomId: courante.room?.id ?? "",
          capacity: courante.capacity,
          registrationOpen: courante.registrationOpen,
          registrationDeadline: courante.registrationDeadline
            ? courante.registrationDeadline.toISOString().slice(0, 10)
            : "",
          waitlistEnabled: courante.waitlistEnabled,
          vipQuota: courante.vipQuota,
          liveStreamUrl: courante.liveStreamUrl ?? "",
          isPublished: courante.isPublished,
        }}
      />

      <TdrForm id={courante.id} present={courante.tdrPath !== null} />
    </div>
  );
}
