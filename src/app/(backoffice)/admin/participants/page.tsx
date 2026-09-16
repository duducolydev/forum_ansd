import { Plus } from "lucide-react";
import { LienBouton } from "@/components/ui/bouton";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import * as service from "@/modules/participants/service";
import { participantSearchSchema } from "@/modules/participants/schema";
import { ParticipantsTable } from "@/modules/participants/components/participants-table";
import { ParticipantsToolbar } from "@/modules/participants/components/participants-toolbar";
import { Pagination } from "@/modules/participants/components/pagination";

export default async function ParticipantsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user || !can(session, "participants.read")) {
    redirect("/admin");
  }

  const sp = await searchParams;
  const search = participantSearchSchema.parse(sp);
  const edition = await getActiveEdition();

  const [{ items, total }, categories] = await Promise.all([
    service.listParticipants(edition.id, search),
    service.listCategories(edition.id),
  ]);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-2xl">Participants</h2>
          <span className="text-text-3 text-sm">
            {total} inscrit{total > 1 ? "s" : ""}
          </span>
        </div>
        {can(session, "participants.write") && (
          <LienBouton href="/admin/participants/nouveau" ton="principal" icone={Plus}>
            Ajouter
          </LienBouton>
        )}
      </div>
      <ParticipantsToolbar categories={categories} />
      <ParticipantsTable data={items} />
      <Pagination
        page={search.page}
        pageSize={search.pageSize}
        total={total}
        basePath="/admin/participants"
        searchParams={sp}
      />
    </div>
  );
}
