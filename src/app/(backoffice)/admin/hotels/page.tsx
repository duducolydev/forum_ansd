import { redirect } from "next/navigation";
import { ArrowUpRight, Plus } from "lucide-react";
import { LienBouton } from "@/components/ui/bouton";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { listHotels } from "@/modules/hotels/service";

const TH =
  "border-border bg-surface-2 text-text-3 border-b px-3.5 py-3 text-left text-xs font-semibold";
const TD = "border-border border-b px-3.5 py-3";

/**
 * Hôtels partenaires (§29).
 *
 * La colonne « Tarifs » précède la colonne « État » : un hôtel publié sans
 * aucun tarif est une fiche vide en ligne, et c'est le défaut qu'on vient
 * repérer ici.
 */
export default async function HotelsPage() {
  const session = await auth();
  if (!session?.user || !can(session, "hotels.manage")) {
    redirect("/admin");
  }

  const edition = await getActiveEdition();
  const hotels = await listHotels(edition.id);
  const publies = hotels.filter((h) => h.isPublished).length;

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-2xl">Hôtels partenaires</h2>
          <span className="text-text-3 text-sm">
            {hotels.length} hôtel(s), dont {publies} publié(s)
          </span>
        </div>
        <LienBouton href="/admin/hotels/nouveau" ton="principal" icone={Plus}>
          Ajouter
        </LienBouton>
      </div>

      <p className="text-text-2 mb-5 max-w-[80ch] text-sm">
        Ces hôtels apparaissent sur la page publique{" "}
        <strong>Infos pratiques &rsaquo; Hébergement</strong>, avec leurs tarifs négociés. Le code
        de réservation n&apos;est jamais affiché : il est communiqué au participant après
        confirmation de son inscription.
      </p>

      <div className="border-border bg-surface overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={TH}>Nom</th>
              <th className={TH}>Catégorie</th>
              <th className={TH}>Quartier</th>
              <th className={TH}>Distance</th>
              <th className={TH}>Tarifs</th>
              <th className={TH}>État</th>
              <th className="border-border bg-surface-2 border-b px-3.5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {hotels.map((hotel) => (
              <tr key={hotel.id} className="hover:bg-blue-soft">
                <td className={`${TD} text-heading font-semibold`}>{hotel.name}</td>
                <td className={TD}>{hotel.category ?? "—"}</td>
                <td className={TD}>{hotel.district ?? "—"}</td>
                <td className={TD}>
                  {hotel.distanceKm === null
                    ? "—"
                    : `${Number(hotel.distanceKm).toString().replace(".", ",")} km`}
                </td>
                <td className={TD}>
                  {hotel._count.rates === 0 ? (
                    <span className="text-warn-text">Aucun</span>
                  ) : (
                    hotel._count.rates
                  )}
                </td>
                <td className={TD}>
                  {hotel.isPublished ? (
                    <span className="text-accent-text">Publié</span>
                  ) : (
                    <span className="text-text-3">Brouillon</span>
                  )}
                </td>
                <td className={TD}>
                  <LienBouton
                    href={`/admin/hotels/${hotel.id}`}
                    ton="discret"
                    taille="petit"
                    icone={ArrowUpRight}
                  >
                    Ouvrir
                  </LienBouton>
                </td>
              </tr>
            ))}
            {hotels.length === 0 && (
              <tr>
                <td colSpan={7} className="text-text-3 px-3.5 py-8 text-center">
                  Aucun hôtel. La page publique annonce une liste à venir.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
