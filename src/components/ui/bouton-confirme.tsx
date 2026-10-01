"use client";

import type { ComponentProps, MouseEvent } from "react";
import { Bouton } from "./bouton";
import { confirmer, type OptionsConfirmation } from "./confirmer";

/**
 * Bouton d'envoi de formulaire qui demande confirmation (1er octobre 2026 :
 * « des confirm SweetAlert2 sur tous les boutons de suppression, de
 * désactivation, de révocation et d'annulation »).
 *
 * Le clic est retenu, la boîte de confirmation s'ouvre, et le formulaire ne
 * part qu'une fois la réponse donnée — par `requestSubmit(bouton)`, qui garde
 * le bouton comme émetteur : un formulaire à plusieurs boutons reçoit bien
 * celui qui a été cliqué.
 *
 * `siNecessaire` : confirmation conditionnelle, lue au moment du clic. Un
 * formulaire de fiche n'a pas à demander « êtes-vous sûr ? » à chaque
 * enregistrement, seulement quand il désactive quelque chose.
 */
export function BoutonEnvoiConfirme({
  confirmation,
  siNecessaire,
  onClick,
  ...reste
}: ComponentProps<typeof Bouton> & {
  confirmation: OptionsConfirmation;
  siNecessaire?: (formulaire: HTMLFormElement) => boolean;
}) {
  function surClic(evenement: MouseEvent<HTMLButtonElement>) {
    onClick?.(evenement);
    if (evenement.defaultPrevented) return;
    const bouton = evenement.currentTarget;
    const formulaire = bouton.form;
    if (!formulaire || (siNecessaire && !siNecessaire(formulaire))) return;
    // Les champs obligatoires sont vérifiés avant la question : confirmer un
    // envoi que le navigateur refuserait ensuite n'aurait pas de sens.
    if (!formulaire.reportValidity()) {
      evenement.preventDefault();
      return;
    }
    evenement.preventDefault();
    void confirmer(confirmation).then((accepte) => {
      if (accepte) formulaire.requestSubmit(bouton);
    });
  }

  return <Bouton type="submit" {...reste} onClick={surClic} />;
}

/**
 * Condition de confirmation la plus courante : une case cochée à l'ouverture
 * de la fiche (« Publié », « Actif ») a été décochée. `defaultChecked` garde
 * l'état reçu du serveur, `checked` l'état actuel.
 */
export function siDecoche(nom: string) {
  return (formulaire: HTMLFormElement): boolean => {
    const champ = formulaire.elements.namedItem(nom);
    return champ instanceof HTMLInputElement && champ.defaultChecked && !champ.checked;
  };
}
