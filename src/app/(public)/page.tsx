import { lireLangue } from "@/lib/langue";
import { getLocale } from "next-intl/server";
import { getActiveEdition } from "@/lib/edition";
import { chargerDonnees } from "@/modules/sections/donnees";
import { sectionsVisibles } from "@/modules/sections/service";
import { lireParametres } from "@/modules/settings/service";
import { etatInscriptions } from "@/modules/settings/regles";
import { SectionsComposees } from "@/modules/sections/components/sections-composees";
import { SectionsParDefaut } from "@/modules/sections/components/sections-par-defaut";
import { FenetreAccesForum } from "@/components/home/FenetreAccesForum";

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
 *
 * S'y ajoute la fenêtre des conditions d'accès (23 octobre 2026), tant que les
 * inscriptions sont ouvertes : elle invite à s'inscrire, ce qui n'a de sens
 * que si le guichet l'accepte.
 */
export default async function HomePage() {
  const locale = lireLangue(await getLocale());
  const edition = await getActiveEdition();
  const sections = await sectionsVisibles(edition.id, "accueil");
  const inscriptionsOuvertes = etatInscriptions(lireParametres(edition).inscriptions).ouvertes;
  const fenetre = inscriptionsOuvertes ? <FenetreAccesForum locale={locale} /> : null;

  if (sections.length === 0) {
    return (
      <>
        <SectionsParDefaut edition={edition} page="accueil" locale={locale} />
        {fenetre}
      </>
    );
  }

  const donnees = await chargerDonnees(edition, sections);

  return (
    <>
      <SectionsComposees sections={sections} donnees={donnees} locale={locale} />
      {fenetre}
    </>
  );
}
