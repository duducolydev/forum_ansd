import Image from "next/image";

/**
 * Logo officiel du Forum (PLAN.md §20) : version à fond transparent fournie par
 * le commanditaire, `public/images/logo_forum_transparent.png` (4 460 × 2 000 px),
 * posée directement sur le fond, sans pastille.
 *
 * `unoptimized` : l'optimiseur de Next ajouterait une dépendance d'exécution
 * (`sharp`).
 */
export const LOGO_FORUM = {
  src: "/images/logo_forum_transparent.png",
  largeur: 4460,
  hauteur: 2000,
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
   * - `pleine-largeur` : l'image prend toute la largeur offerte et sa hauteur
   *   suit. Réservé aux conteneurs dont la largeur est **contrainte et connue**,
   *   comme la barre latérale du BackOffice : ailleurs, un logo de 4 460 px de
   *   large occuperait l'écran entier.
   */
  taille: "h-11" | "h-14" | "h-16" | "pleine-largeur";
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
        className={pleineLargeur ? "h-auto w-full" : `${taille} w-auto`}
      />
    </span>
  );
}
