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
  hauteur,
  prioritaire = false,
}: {
  /** Vide quand le lien qui l'entoure porte déjà le nom (en-tête). */
  alt: string;
  /** Classe de hauteur de l'image, la largeur suit le rapport du logo. */
  hauteur: "h-11" | "h-14";
  prioritaire?: boolean;
}) {
  return (
    <span className="inline-flex shrink-0">
      <Image
        src={LOGO_FORUM.src}
        alt={alt}
        width={LOGO_FORUM.largeur}
        height={LOGO_FORUM.hauteur}
        unoptimized
        priority={prioritaire}
        className={`${hauteur} w-auto`}
      />
    </span>
  );
}
