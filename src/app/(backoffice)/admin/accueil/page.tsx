import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { getActiveEdition } from "@/lib/edition";
import { OnsiteDesk } from "@/modules/onsite/components/onsite-desk";

export const dynamic = "force-dynamic";

export default async function AccueilPage() {
  const session = await auth();
  if (!session?.user) redirect("/connexion");
  if (!can(session, "badges.generate") || !can(session, "participants.write")) {
    return (
      <div className="border-border bg-surface text-text-2 rounded-xl border p-5">
        Votre rôle ne permet pas d&apos;inscrire au comptoir.
      </div>
    );
  }

  const edition = await getActiveEdition();
  const [categories, checkpoints] = await Promise.all([
    prisma.participantCategory.findMany({
      where: { editionId: edition.id, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, labelFr: true },
    }),
    prisma.checkpoint.findMany({
      where: { editionId: edition.id, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, zone: { select: { code: true } } },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl">Accueil</h2>
        <p className="text-text-3 text-sm">
          Retrouver ou inscrire, valider, badger et faire entrer — sans quitter cet écran.
        </p>
      </div>

      <OnsiteDesk
        categories={categories}
        checkpoints={checkpoints.map((point) => ({
          id: point.id,
          name: point.name,
          zoneCode: point.zone.code,
        }))}
      />
    </div>
  );
}
