import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * En-tête de section du site public (§10).
 *
 * Trois niveaux constants d'une page à l'autre : un sur-titre court, le titre,
 * puis une phrase d'explication facultative. C'est ce qui donne au site son
 * rythme — chaque page reprenait jusqu'ici une composition différente, et
 * l'ensemble se lisait comme une suite d'écrans sans parenté.
 *
 * `niveau` existe parce que la hiérarchie des titres est sémantique : la page
 * d'accueil porte son `h1` dans le bandeau, ses sections sont donc en `h2` ;
 * une page intérieure ouvre en `h1`. Sauter un palier désoriente la navigation
 * par titres des lecteurs d'écran (défaut déjà corrigé en T34).
 */
export function EnteteSection({
  surtitre,
  titre,
  description,
  icone: Icone,
  niveau = "h2",
  action,
  centre = false,
  bandeau = false,
}: {
  surtitre?: string;
  titre: string;
  description?: string;
  icone?: LucideIcon;
  niveau?: "h1" | "h2";
  /** Bouton ou lien aligné à droite du titre. */
  action?: ReactNode;
  centre?: boolean;
  /**
   * En-tête posé dans un `BandeauPage` : sans marge dessous — le `py` du
   * bandeau fournit la respiration —, et resserré, le bandeau étant ramené au
   * strict nécessaire (PLAN.md §19).
   *
   * Un booléen plutôt qu'une classe passée par `className` : `mb-8` et `mb-0`
   * sont deux utilitaires de la même propriété, et c'est l'ordre de la feuille
   * de style — pas celui de l'attribut — qui trancherait.
   */
  bandeau?: boolean;
}) {
  const Titre = niveau;

  return (
    <div
      className={`flex flex-wrap items-end gap-4 ${bandeau ? "" : "mb-8"} ${
        centre ? "flex-col items-center text-center" : "justify-between"
      }`}
    >
      <div className={centre ? "max-w-[62ch]" : "max-w-[62ch]"}>
        {surtitre && (
          <span
            className={`surtitre ${bandeau ? "mb-1" : "mb-3"} ${centre ? "justify-center" : ""}`}
          >
            {surtitre}
          </span>
        )}
        <Titre className="flex items-center gap-3">
          {Icone && (
            <Icone
              aria-hidden
              size={bandeau ? 24 : niveau === "h1" ? 28 : 22}
              className="text-accent-text shrink-0"
            />
          )}
          {titre}
        </Titre>
        {description && (
          <p className={bandeau ? "text-text-2 mt-1" : "text-text-2 mt-3 text-lg"}>{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
