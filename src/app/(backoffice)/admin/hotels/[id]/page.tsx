import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { findHotelById, prestations } from "@/modules/hotels/service";
import { updateHotelAction } from "@/modules/hotels/actions";
import { HotelForm } from "@/modules/hotels/components/hotel-form";
import { TarifsHotel } from "@/modules/hotels/components/tarifs-hotel";
import { SupprimerHotel } from "@/modules/hotels/components/supprimer-hotel";

/**
 * Fiche d'un hôtel : ses informations, ses tarifs, son retrait (§29).
 *
 * Tout sur une seule page plutôt qu'en onglets : la saisie d'un hôtel se fait
 * d'une traite, au téléphone avec l'établissement, et changer d'écran pour
 * ajouter un tarif aurait coupé ce geste en deux.
 */
export default async function FicheHotelPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !can(session, "hotels.manage")) {
    redirect("/admin/hotels");
  }

  const { id } = await params;
  const hotel = await findHotelById(id);
  if (!hotel) notFound();

  const boundAction = updateHotelAction.bind(null, hotel.id);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl">{hotel.name}</h2>
        {hotel.isPublished && (
          <Link
            href="/infos-pratiques/hebergement"
            className="text-link flex items-center gap-1.5 text-sm underline"
          >
            Voir sur le site
            <ExternalLink aria-hidden size={13} />
          </Link>
        )}
      </div>

      <div className="border-border bg-surface rounded-xl border p-6">
        <HotelForm
          action={boundAction}
          submitLabel="Enregistrer"
          defaultValues={{
            name: hotel.name,
            category: hotel.category ?? undefined,
            address: hotel.address ?? undefined,
            district: hotel.district ?? undefined,
            distanceKm: hotel.distanceKm === null ? undefined : Number(hotel.distanceKm),
            phone: hotel.phone ?? undefined,
            email: hotel.email ?? undefined,
            website: hotel.website ?? undefined,
            mapUrl: hotel.mapUrl ?? undefined,
            descriptionFr: hotel.descriptionFr ?? undefined,
            descriptionEn: hotel.descriptionEn ?? undefined,
            amenities: prestations(hotel.amenities).join(", "),
            bookingCode: hotel.bookingCode ?? undefined,
            bookingUrl: hotel.bookingUrl ?? undefined,
            isPublished: hotel.isPublished,
            sortOrder: hotel.sortOrder,
          }}
        />
      </div>

      <div className="border-border bg-surface mt-5 rounded-xl border p-6">
        <h3 className="mb-1 text-lg">Tarifs négociés</h3>
        <p className="text-text-2 mb-4 text-sm">
          Un tarif par type de chambre. Laissé vide, le prix s&apos;affiche « sur demande » plutôt
          que zéro.
        </p>
        <TarifsHotel hotelId={hotel.id} tarifs={hotel.rates} />
      </div>

      <div className="border-border bg-surface mt-5 rounded-xl border p-6">
        <h3 className="mb-1 text-lg">Retirer cet hôtel</h3>
        <p className="text-text-2 mb-3 text-sm">
          L&apos;hôtel disparaît du site et du BackOffice, mais la fiche est conservée : des
          participants ont pu réserver sur la foi de ce qui leur a été annoncé, et cette trace ne
          doit pas s&apos;effacer.
        </p>
        <SupprimerHotel hotelId={hotel.id} nom={hotel.name} />
      </div>
    </div>
  );
}
