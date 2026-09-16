import Swal, { type SweetAlertIcon } from "sweetalert2";

/**
 * Confirmation d'une action, en remplacement de `window.confirm`.
 *
 * SweetAlert2 est habillé avec **les jetons du thème** plutôt qu'avec ses
 * couleurs par défaut : une boîte de dialogue qui ignore le thème sombre du
 * BackOffice se remarque plus qu'elle ne rassure. Les couleurs viennent des
 * variables CSS déjà vérifiées en contraste (`palette.test.ts`), ce qui évite
 * d'introduire ici des teintes que rien ne contrôle.
 *
 * Rendu dans un conteneur à part, hors du flux React : SweetAlert2 manipule le
 * DOM directement, et le laisser écrire dans un arbre géré par React produit
 * des incohérences d'hydratation.
 */
export interface OptionsConfirmation {
  titre: string;
  texte?: string;
  /** Libellé du bouton d'action. Doit dire ce qui va se passer, pas « OK ». */
  confirmer: string;
  annuler?: string;
  /** `danger` pour une action irréversible : le bouton passe en rouge. */
  ton?: "danger" | "neutre";
  icone?: SweetAlertIcon;
}

function jeton(nom: string, repli: string): string {
  if (typeof window === "undefined") return repli;
  const valeur = getComputedStyle(document.documentElement).getPropertyValue(nom).trim();
  return valeur || repli;
}

export async function confirmer(options: OptionsConfirmation): Promise<boolean> {
  const danger = options.ton === "danger";

  const resultat = await Swal.fire({
    title: options.titre,
    text: options.texte,
    icon: options.icone ?? (danger ? "warning" : "question"),
    showCancelButton: true,
    confirmButtonText: options.confirmer,
    cancelButtonText: options.annuler ?? "Annuler",
    // Le bouton d'annulation a le focus : sur une action irréversible, la
    // touche Entrée réflexe ne doit pas valider la suppression.
    focusCancel: danger,
    reverseButtons: true,
    background: jeton("--surface", "#ffffff"),
    color: jeton("--text", "#12212f"),
    confirmButtonColor: danger ? jeton("--rouge", "#c8323a") : jeton("--primary", "#1d8247"),
    cancelButtonColor: jeton("--bg-3", "#e8f0f8"),
    customClass: {
      popup: "forum-swal",
      cancelButton: "forum-swal-annuler",
    },
  });

  return resultat.isConfirmed;
}

/**
 * Poignée de clic qui demande confirmation avant d'agir.
 *
 * Rend un gestionnaire **synchrone** : un `onClick` déclaré `async` renvoie une
 * promesse que React ignore, ce que `no-misused-promises` signale à juste
 * titre. Passer par cette fabrique garde les appels courts et identiques d'un
 * écran à l'autre — c'est la dispersion des formulations qui rendait les
 * anciennes boîtes natives incohérentes.
 */
export function auClicConfirme(options: OptionsConfirmation, action: () => void): () => void {
  return () => {
    void confirmer(options).then((accepte) => {
      if (accepte) action();
    });
  };
}

/** Message court après une action réussie, sans bouton à cliquer. */
export async function informer(titre: string, texte?: string): Promise<void> {
  await Swal.fire({
    title: titre,
    text: texte,
    icon: "success",
    timer: 1800,
    showConfirmButton: false,
    background: jeton("--surface", "#ffffff"),
    color: jeton("--text", "#12212f"),
    customClass: { popup: "forum-swal" },
  });
}
