/**
 * Un référent encore rattaché à des délégations ne se supprime pas.
 *
 * La base sait faire : le lien est en `SET NULL`, la suppression passerait et
 * les délégations se retrouveraient sans référent, sans que personne l'ait
 * voulu ni remarqué. La règle est donc posée ici, au-dessus, avec le compte des
 * délégations concernées pour que le message dise quoi faire.
 */
export class ReferentRattacheError extends Error {
  constructor(public readonly delegations: number) {
    super(
      `Ce référent accompagne encore ${delegations} délégation${delegations > 1 ? "s" : ""}. ` +
        "Rattachez-les à quelqu'un d'autre, ou désactivez la fiche plutôt que de la supprimer.",
    );
    this.name = "ReferentRattacheError";
  }
}

/** Deux fiches pour la même adresse feraient partir chaque alerte en double. */
export class ReferentEmailExistantError extends Error {
  constructor(public readonly email: string) {
    super(`Un référent existe déjà avec l'adresse ${email} pour cette édition.`);
    this.name = "ReferentEmailExistantError";
  }
}
