import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Eyebrow } from "@/components/motion/Reveal";
import { ScrambleText } from "@/components/motion/ScrambleText";
import { SplitTitle } from "@/components/motion/SplitTitle";

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
   * En-tête posé dans un `BandeauPage` : **le titre seul**, sans marge dessous
   * — le `py` du bandeau fournit la respiration.
   *
   * `surtitre` et `description` sont alors **ignorés** (demande du
   * commanditaire, 22 septembre 2026). Un bandeau de trois niveaux repoussait
   * la liste des intervenants, la grille du programme ou le formulaire
   * d'inscription sous la ligne de flottaison : le visiteur arrivait sur une
   * page dont il ne voyait que le nom, qu'il venait de cliquer.
   *
   * Les deux propriétés restent acceptées et continuent d'être passées par les
   * pages : c'est ici, en un seul endroit, qu'on décide de les afficher ou non
   * — les rallumer plus tard ne demandera pas de retrouver onze textes effacés.
   *
   * Un booléen plutôt qu'une classe passée par `className` : `mb-8` et `mb-0`
   * sont deux utilitaires de la même propriété, et c'est l'ordre de la feuille
   * de style — pas celui de l'attribut — qui trancherait.
   */
  bandeau?: boolean;
}) {
  const Titre = niveau;

  /*
   * Bandeau « Constellation » (brief §6, arbitrage du 28 septembre 2026) :
   * l'étiquette revient — une ligne, qui se décode lettre par lettre — et le
   * titre arrive lettre par lettre. La description reste retirée : le
   * bandeau doit rester compact.
   */
  if (bandeau) {
    return (
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {surtitre && (
            <Eyebrow className="mb-2 text-[0.72rem]">
              <ScrambleText texte={surtitre} />
            </Eyebrow>
          )}
          <div className="flex items-center gap-3">
            {Icone && <Icone aria-hidden size={26} className="shrink-0 text-[var(--green-text)]" />}
            <SplitTitle as={Titre} texte={titre} delaiInitial={0.1} className="titre-page" />
          </div>
        </div>
        {action}
      </div>
    );
  }

  return (
    <div
      className={`mb-8 flex flex-wrap items-end gap-4 ${
        centre ? "flex-col items-center text-center" : "justify-between"
      }`}
    >
      <div className={centre ? "max-w-[62ch]" : "max-w-[62ch]"}>
        {surtitre && (
          <span className={`surtitre mb-3 ${centre ? "justify-center" : ""}`}>{surtitre}</span>
        )}
        <Titre className="flex items-center gap-3">
          {Icone && (
            <Icone
              aria-hidden
              size={niveau === "h1" ? 28 : 22}
              className="text-accent-text shrink-0"
            />
          )}
          {titre}
        </Titre>
        {description && <p className="text-text-2 mt-3 text-lg">{description}</p>}
      </div>
      {action}
    </div>
  );
}
