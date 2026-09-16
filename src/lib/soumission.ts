"use client";

import { useTransition, type FormEvent } from "react";

/**
 * Envoi d'un formulaire **sans la remise à zéro automatique de React 19**.
 *
 * ## Le défaut que cela ferme
 *
 * Avec `<form action={…}>`, React 19 remet le formulaire à zéro après chaque
 * action — y compris quand elle se solde par un refus. Deux conséquences,
 * constatées sur la saisie des contributions :
 *
 * 1. Ce que l'agent a tapé disparaît au premier refus : un lien vidéo mal collé
 *    effaçait aussi le titre et le texte.
 * 2. Plus sournois : une liste déroulante **contrôlée** est ramenée à son
 *    option par défaut dans la page, alors que l'état React garde la valeur
 *    choisie. L'écran continue d'afficher les champs du type « Vidéo », mais le
 *    formulaire envoie un autre type, et le serveur répond « ce type de
 *    contribution n'accepte pas de lien ». L'agent n'a rien changé ; le
 *    formulaire, si.
 *
 * Renvoyer les valeurs saisies avec le refus corrigeait le premier point, pas
 * le second. La correction qui règle les deux est de ne pas laisser React
 * vider le formulaire : l'envoi part d'un `onSubmit`, dans une transition, ce
 * qui garde l'état « en cours » de `useActionState` sans déclencher la remise à
 * zéro. Vider le formulaire après un succès devient une décision explicite de
 * l'écran.
 */
export function useSoumissionSansRemiseAZero(action: (donnees: FormData) => void) {
  const [, demarrer] = useTransition();

  function soumettre(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    const donnees = new FormData(evenement.currentTarget);
    demarrer(() => action(donnees));
  }

  return { soumettre };
}
