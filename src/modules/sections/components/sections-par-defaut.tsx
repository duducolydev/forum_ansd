import type { Langue } from "@/lib/langue";
import type { Edition, PageSection } from "@prisma/client";
import { getContentText } from "@/modules/content/service";
import { chargerDonnees } from "../donnees";
import { blocsRequis, COMPOSITIONS, resoudreContenu } from "../defaut";
import { SectionsComposees } from "./sections-composees";

/**
 * Composition d'origine d'une page, rendue tant qu'aucune section n'a été
 * enregistrée (§8.4).
 *
 * Elle passe par les **mêmes composants de rendu** que les sections
 * enregistrées, à partir de sections construites en mémoire : deux rendus
 * parallèles auraient divergé au premier ajustement, et c'est la version de
 * repli — celle que personne ne regarde — qui aurait vieilli.
 *
 * La composition elle-même vit dans `defaut.ts`, en données : le service s'en
 * sert pour la **matérialiser en base** dès qu'on ajoute une première section,
 * afin que reprendre la main n'efface pas la page.
 */
export async function SectionsParDefaut({
  edition,
  page,
  locale,
}: {
  edition: Edition;
  page: string;
  locale: Langue;
}) {
  const composition = COMPOSITIONS[page] ?? [];
  if (composition.length === 0) return null;

  const cles = blocsRequis(composition);
  const valeurs = await Promise.all(cles.map((cle) => getContentText(edition.id, cle, locale)));
  const textes = Object.fromEntries(cles.map((cle, index) => [cle, valeurs[index]!]));

  const sections: PageSection[] = composition.map((modele, rang) => ({
    id: `defaut-${modele.type}-${rang}`,
    editionId: edition.id,
    page,
    type: modele.type,
    variant: modele.variant,
    sortOrder: modele.sortOrder,
    isVisible: true,
    settings: modele.settings as object,
    contentFr: resoudreContenu(modele, textes, "fr"),
    contentEn: resoudreContenu(modele, textes, "en"),
    contentPt: resoudreContenu(modele, textes, "pt"),
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }));

  const donnees = await chargerDonnees(edition, sections);

  return <SectionsComposees sections={sections} donnees={donnees} locale={locale} />;
}
