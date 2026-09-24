import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { createHotelAction } from "@/modules/hotels/actions";
import { HotelForm } from "@/modules/hotels/components/hotel-form";

export default async function NouvelHotelPage() {
  const session = await auth();
  if (!session?.user || !can(session, "hotels.manage")) {
    redirect("/admin/hotels");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-5 text-2xl">Ajouter un hôtel</h2>
      <p className="text-text-2 mb-5 text-sm">
        Les tarifs se saisissent ensuite, sur la fiche de l&apos;hôtel. Laissez la case « Publié »
        décochée le temps de les obtenir.
      </p>
      <div className="border-border bg-surface rounded-xl border p-6">
        <HotelForm action={createHotelAction} submitLabel="Créer l'hôtel" />
      </div>
    </div>
  );
}
