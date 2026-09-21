/**
 * Messages de la page de connexion.
 *
 * `CODE_SENT` n'est pas une erreur mais une étape : le mot de passe a été
 * accepté, un code part vers l'adresse du compte (PLAN.md §23). Le formulaire
 * l'affiche en information, pas en rouge.
 */
export function loginErrorMessage(code: string | undefined): string | null {
  switch (code) {
    case "INVALID_CREDENTIALS":
      return "Identifiants invalides.";
    case "INACTIVE":
      return "Ce compte est désactivé.";
    case "LOCKED":
      return "Compte verrouillé après plusieurs échecs. Réessayez dans 15 minutes.";
    case "CODE_INVALID":
      return "Code incorrect ou expiré. Demandez-en un nouveau en vous reconnectant.";
    case "CODE_THROTTLED":
      return "Trop de demandes de code. Patientez une minute avant de réessayer.";
    case undefined:
      return null;
    default:
      return "Une erreur est survenue. Réessayez.";
  }
}

/** Message d'étape, affiché quand le code vient d'être envoyé. */
export function loginInfoMessage(code: string | undefined): string | null {
  return code === "CODE_SENT"
    ? "Un code à 6 chiffres vient de vous être envoyé par e-mail. Saisissez-le ci-dessous, ou ouvrez le lien du message."
    : null;
}
