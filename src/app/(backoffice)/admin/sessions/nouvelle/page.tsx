import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { listRooms } from "@/modules/sessions/service";
import { SessionForm } from "@/modules/sessions/components/session-form";

export const dynamic = "force-dynamic";

export default async function NouvelleSessionPage() {
  const session = await auth();
  if (!session?.user) redirect("/connexion");
  if (!can(session, "sessions.write")) redirect("/admin/sessions");

  const edition = await getActiveEdition();
  const salles = await listRooms(edition.id);

  return (
    <div>
      <Link href="/admin/sessions" className="text-text-3 text-sm">
        Programme
      </Link>
      <h2 className="mt-2 mb-5 text-2xl">Nouvelle session</h2>

      <SessionForm
        salles={salles.map((salle) => ({
          id: salle.id,
          name: salle.name,
          capacity: salle.capacity,
        }))}
        valeurs={{
          slug: "",
          type: "PANEL",
          number: null,
          titleFr: "",
          titleEn: "",
          descriptionFr: "",
          descriptionEn: "",
          objectives: "",
          theme: "",
          day: edition.startDate.toISOString().slice(0, 10),
          startTime: "09:00",
          endTime: "10:30",
          roomId: "",
          capacity: null,
          registrationOpen: false,
          registrationDeadline: "",
          waitlistEnabled: true,
          vipQuota: null,
          liveStreamUrl: "",
          isPublished: false,
        }}
      />
    </div>
  );
}
