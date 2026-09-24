import { ExternalLink, MapPin, Phone, Mail, Ticket } from "lucide-react";
import { TexteRiche } from "@/components/site/texte-riche";
import { resolveLocaleValue } from "@/modules/content/service";
import { prestations } from "../service";

interface Tarif {
  id: string;
  roomType: string;
  price: number | null;
  currency: string;
  conditions: string | null;
}

interface HotelPublic {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  district: string | null;
  distanceKm: unknown;
  phone: string | null;
  email: string | null;
  website: string | null;
  mapUrl: string | null;
  descriptionFr: string | null;
  descriptionEn: string | null;
  amenities: unknown;
  bookingCode: string | null;
  bookingUrl: string | null;
  rates: Tarif[];
}

/**
 * Montant en francs CFA, groupé par milliers.
 *
 * `fr-FR` quelle que soit la langue de la page : le séparateur de milliers
 * anglais est la virgule, et « 85,000 » se lit « 85 » pour un lecteur
 * francophone — l'écart d'un facteur mille sur un tarif d'hôtel n'est pas une
 * nuance typographique.
 */
function montant(prix: number | null, devise: string): string {
  if (prix === null) return "Sur demande";
  return `${new Intl.NumberFormat("fr-FR").format(prix)} ${devise}`;
}

/** `Decimal` de Prisma, rendu sans la représentation interne. */
function distance(valeur: unknown): string | null {
  if (valeur === null || valeur === undefined) return null;
  const nombre = Number(valeur);
  if (Number.isNaN(nombre)) return null;
  return `${nombre.toString().replace(".", ",")} km du Forum`;
}

/**
 * Liste des hôtels partenaires, page de détail « Hébergement » (§29).
 *
 * Une fiche par hôtel avec ses tarifs en tableau : le visiteur compare des
 * prix et des distances, et c'est la seule présentation qui le permette d'un
 * coup d'œil. Le code de réservation n'y figure pas — il est envoyé après
 * confirmation d'inscription, et l'afficher publiquement le rendrait utilisable
 * par n'importe qui.
 */
export function ListeHotels({ hotels, locale }: { hotels: HotelPublic[]; locale: "fr" | "en" }) {
  if (hotels.length === 0) {
    return (
      <p className="text-text-2">
        {locale === "en"
          ? "The list of partner hotels will be published shortly."
          : "La liste des hôtels partenaires sera publiée prochainement."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {hotels.map((hotel) => {
        const description = resolveLocaleValue(hotel.descriptionFr, hotel.descriptionEn, locale);
        const services = prestations(hotel.amenities);
        const aDistance = distance(hotel.distanceKm);

        return (
          <article
            key={hotel.id}
            className="border-border bg-surface rounded-xl border p-5.5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-heading font-display text-lg font-semibold">{hotel.name}</h3>
                <p className="text-text-3 mt-0.5 text-sm">
                  {[hotel.category, hotel.district, aDistance].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              {hotel.website && (
                <a
                  href={hotel.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-link flex items-center gap-1.5 text-sm underline"
                >
                  {locale === "en" ? "Website" : "Site web"}
                  <ExternalLink aria-hidden size={13} />
                </a>
              )}
            </div>

            {description && (
              <TexteRiche
                valeur={description}
                className="text-text-2 mt-3 text-sm leading-relaxed"
              />
            )}

            {services.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {services.map((service) => (
                  <li
                    key={service}
                    className="bg-bg-2 text-text-2 rounded-full px-2.5 py-1 text-xs"
                  >
                    {service}
                  </li>
                ))}
              </ul>
            )}

            {hotel.rates.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="text-text-3 mb-2 text-left text-xs">
                    {locale === "en" ? "Negotiated rates" : "Tarifs négociés"}
                  </caption>
                  <thead>
                    <tr>
                      <th className="border-border text-text-3 border-b py-2 pr-3 text-left text-xs font-semibold">
                        {locale === "en" ? "Room" : "Chambre"}
                      </th>
                      <th className="border-border text-text-3 border-b py-2 pr-3 text-left text-xs font-semibold">
                        {locale === "en" ? "Rate / night" : "Tarif / nuit"}
                      </th>
                      <th className="border-border text-text-3 border-b py-2 text-left text-xs font-semibold">
                        {locale === "en" ? "Conditions" : "Conditions"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {hotel.rates.map((tarif) => (
                      <tr key={tarif.id}>
                        <td className="border-border text-heading border-b py-2 pr-3">
                          {tarif.roomType}
                        </td>
                        <td className="border-border border-b py-2 pr-3 whitespace-nowrap tabular-nums">
                          {montant(tarif.price, tarif.currency)}
                        </td>
                        <td className="border-border text-text-2 border-b py-2">
                          {tarif.conditions ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <ul className="text-text-2 mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
              {hotel.address && (
                <li className="flex items-center gap-1.5">
                  <MapPin aria-hidden size={14} className="text-text-3 shrink-0" />
                  {hotel.mapUrl ? (
                    <a
                      href={hotel.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-link underline"
                    >
                      {hotel.address}
                    </a>
                  ) : (
                    hotel.address
                  )}
                </li>
              )}
              {hotel.phone && (
                <li className="flex items-center gap-1.5">
                  <Phone aria-hidden size={14} className="text-text-3 shrink-0" />
                  <a href={`tel:${hotel.phone.replace(/\s/g, "")}`} className="text-link underline">
                    {hotel.phone}
                  </a>
                </li>
              )}
              {hotel.email && (
                <li className="flex items-center gap-1.5">
                  <Mail aria-hidden size={14} className="text-text-3 shrink-0" />
                  <a href={`mailto:${hotel.email}`} className="text-link underline">
                    {hotel.email}
                  </a>
                </li>
              )}
              {hotel.bookingUrl && (
                <li className="flex items-center gap-1.5">
                  <Ticket aria-hidden size={14} className="text-text-3 shrink-0" />
                  <a
                    href={hotel.bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-link underline"
                  >
                    {locale === "en" ? "Book" : "Réserver"}
                  </a>
                </li>
              )}
            </ul>
          </article>
        );
      })}
    </div>
  );
}
