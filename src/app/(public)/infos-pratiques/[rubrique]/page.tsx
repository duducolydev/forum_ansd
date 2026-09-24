import { notFound } from "next/navigation";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { getActiveEdition } from "@/lib/edition";
import { getContentText, resolveLocaleValue } from "@/modules/content/service";
import { listHotelsPublies, listContacts } from "@/modules/hotels/service";
import { RUBRIQUES, libelle, rubriqueParSegment } from "@/modules/hotels/rubriques";
import { ListeHotels } from "@/modules/hotels/components/liste-hotels";
import { EnteteSection } from "@/components/site/entete-section";
import { TexteRiche } from "@/components/site/texte-riche";
import { BandeauPage, CorpsPage } from "@/components/site/bandeau-page";

/**
 * Page de détail d'une rubrique pratique (§29).
 *
 * Une seule route pour les six : elles partagent leur gabarit, et six fichiers
 * jumeaux auraient divergé au premier ajustement. Ce qui les distingue —
 * l'icône, le texte long, la liste structurée — est déclaré dans
 * `modules/hotels/rubriques.ts`, lu aussi par la page qui les annonce.
 */

/** Les six segments sont connus : autant les rendre à la construction. */
export function generateStaticParams() {
  return RUBRIQUES.map((rubrique) => ({ rubrique: rubrique.segment }));
}

export async function generateMetadata({ params }: { params: Promise<{ rubrique: string }> }) {
  const { rubrique: segment } = await params;
  const rubrique = rubriqueParSegment(segment);
  if (!rubrique) return {};
  const locale = (await getLocale()) as "fr" | "en";
  return { title: `${libelle(rubrique, locale)} — Infos pratiques` };
}

export default async function DetailRubriquePage({
  params,
}: {
  params: Promise<{ rubrique: string }>;
}) {
  const { rubrique: segment } = await params;
  const rubrique = rubriqueParSegment(segment);
  if (!rubrique) notFound();

  const locale = (await getLocale()) as "fr" | "en";
  const edition = await getActiveEdition();

  // Le résumé sert de chapeau : le visiteur arrive d'un encart qui le portait,
  // et le retrouver en tête confirme qu'il est au bon endroit.
  const resume = await getContentText(edition.id, rubrique.cle, locale);
  const detail = rubrique.cleDetail
    ? await getContentText(edition.id, rubrique.cleDetail, locale)
    : "";

  const hotels = rubrique.liste === "hotels" ? await listHotelsPublies(edition.id) : [];
  const contacts = rubrique.liste === "contacts" ? await listContacts(edition.id) : [];

  return (
    <>
      <BandeauPage largeur="moyen">
        <EnteteSection
          bandeau
          niveau="h1"
          titre={libelle(rubrique, locale)}
          icone={rubrique.icone}
        />
      </BandeauPage>

      <CorpsPage largeur="moyen">
        <Link
          href="/infos-pratiques"
          className="text-link mb-6 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft aria-hidden size={15} />
          {locale === "en" ? "All practical information" : "Toutes les infos pratiques"}
        </Link>

        {resume && (
          <TexteRiche valeur={resume} className="text-text-2 mb-6 text-lg leading-relaxed" />
        )}

        {detail && <TexteRiche valeur={detail} className="text-text mb-8 leading-relaxed" />}

        {rubrique.liste === "hotels" && <ListeHotels hotels={hotels} locale={locale} />}

        {rubrique.liste === "contacts" && (
          <>
            {contacts.length === 0 ? (
              <p className="text-text-2">
                {locale === "en"
                  ? "Contact details will be published shortly."
                  : "Les contacts seront publiés prochainement."}
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {contacts.map((contact) => (
                  <li
                    key={contact.id}
                    className="border-border bg-surface rounded-xl border p-5 shadow-sm"
                  >
                    <h2 className="text-heading font-display text-base font-semibold">
                      {resolveLocaleValue(contact.labelFr, contact.labelEn, locale)}
                    </h2>
                    {contact.name && <p className="text-text-2 mt-1 text-sm">{contact.name}</p>}
                    <ul className="mt-2 flex flex-col gap-1 text-sm">
                      {contact.email && (
                        <li className="flex items-center gap-1.5">
                          <Mail aria-hidden size={14} className="text-text-3 shrink-0" />
                          <a href={`mailto:${contact.email}`} className="text-link underline">
                            {contact.email}
                          </a>
                        </li>
                      )}
                      {contact.phone && (
                        <li className="flex items-center gap-1.5">
                          <Phone aria-hidden size={14} className="text-text-3 shrink-0" />
                          <a
                            href={`tel:${contact.phone.replace(/\s/g, "")}`}
                            className="text-link underline"
                          >
                            {contact.phone}
                          </a>
                        </li>
                      )}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {/*
          Rubrique encore vide : on le dit, plutôt que de laisser une page
          blanche qui ressemble à une panne.
        */}
        {!resume && !detail && !rubrique.liste && (
          <p className="text-text-2">
            {locale === "en"
              ? "This section will be published shortly."
              : "Cette rubrique sera publiée prochainement."}
          </p>
        )}
      </CorpsPage>
    </>
  );
}
