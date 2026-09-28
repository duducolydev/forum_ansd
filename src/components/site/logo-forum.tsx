import Image from "next/image";

/**
 * Logo officiel du Forum (PLAN.md §20) : version « Dakar 2026 » à fond
 * transparent fournie par le commanditaire le 28 septembre 2026
 * (`LOGO FORUM INTERNATIONAL OK transparent_Plan de travail 1.png`), recadrée
 * sur son contenu — l'original portait une marge transparente qui rapetissait
 * le logo d'autant — et ramenée à 1 800 px de large en WebP : 168 Ko au lieu
 * des 362 Ko du PNG, pour une image chargée en tête de chaque page.
 *
 * `unoptimized` : l'optimiseur de Next ajouterait une dépendance d'exécution
 * (`sharp`).
 */
export const LOGO_FORUM = {
  src: "/images/logo-forum-2026.webp",
  largeur: 1800,
  hauteur: 793,
} as const;

export function LogoForum({
  alt,
  taille,
  prioritaire = false,
}: {
  /** Vide quand le lien qui l'entoure porte déjà le nom (en-tête). */
  alt: string;
  /**
   * Dimension de l'image.
   *
   * - `h-11`, `h-14`, `h-16` : hauteur fixe, la largeur suit le rapport du
   *   logo. C'est la forme qui convient partout où la place horizontale est
   *   disputée — une barre de navigation, un pied de page.
   * - `entete` : la barre de navigation du site, 56 px sur téléphone et 80 px
   *   sur grand écran.
   * - `pleine-largeur` : l'image prend toute la largeur offerte et sa hauteur
   *   suit. Réservé aux conteneurs dont la largeur est **contrainte et connue**,
   *   comme la barre latérale du BackOffice : ailleurs, un logo de 4 460 px de
   *   large occuperait l'écran entier.
   */
  taille: "h-11" | "h-14" | "h-16" | "entete" | "pleine-largeur";
  prioritaire?: boolean;
}) {
  const pleineLargeur = taille === "pleine-largeur";

  return (
    <span className={`inline-flex ${pleineLargeur ? "w-full" : "shrink-0"}`}>
      <Image
        src={LOGO_FORUM.src}
        alt={alt}
        width={LOGO_FORUM.largeur}
        height={LOGO_FORUM.hauteur}
        unoptimized
        priority={prioritaire}
        className={
          pleineLargeur
            ? "h-auto w-full"
            : `${taille === "entete" ? "h-14 lg:h-20" : taille} w-auto`
        }
      />
    </span>
  );
}
