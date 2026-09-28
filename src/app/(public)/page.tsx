import { getLocale } from "next-intl/server";
import { getActiveEdition } from "@/lib/edition";
import { chargerDonnees } from "@/modules/sections/donnees";
import { sectionsVisibles } from "@/modules/sections/service";
import { RenduSection } from "@/modules/sections/components/rendu-section";
import { SectionsParDefaut } from "@/modules/sections/components/sections-par-defaut";

export async function generateMetadata() {
  const edition = await getActiveEdition();
  return {
    title: edition.title,
    description: edition.theme ?? undefined,
    openGraph: { title: edition.title, description: edition.theme ?? undefined },
  };
}

/**
 * Page d'accueil composée de sections paramétrables (§8.4).
 *
 * Les sections viennent de la base, dans l'ordre choisi en BackOffice. Tant
 * qu'aucune n'est configurée, la composition d'origine est rendue : une
 * installation neuve, ou une édition créée avant ce chantier, ne doit pas
 * afficher une page blanche.
 */
export default async function HomePage() {
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  const edition = await getActiveEdition();
  const sections = await sectionsVisibles(edition.id, "accueil");

  if (sections.length === 0) {
    return <SectionsParDefaut edition={edition} page="accueil" locale={locale} />;
  }

  const donnees = await chargerDonnees(edition, sections);

  return (
    <>
      {sections.map((section) => (
        <RenduSection key={section.id} section={section} donnees={donnees} locale={locale} />
      ))}
    </>
  );
}
