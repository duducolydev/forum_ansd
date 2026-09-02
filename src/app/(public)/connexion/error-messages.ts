export function loginErrorMessage(code: string | undefined): string | null {
  switch (code) {
    case "INVALID_CREDENTIALS":
      return "Identifiants invalides.";
    case "INACTIVE":
      return "Ce compte est désactivé.";
    case "LOCKED":
      return "Compte verrouillé après plusieurs échecs. Réessayez dans 15 minutes.";
    case "TOTP_REQUIRED":
      return "Ce compte nécessite un code de vérification à 6 chiffres.";
    case "TOTP_INVALID":
      return "Code de vérification incorrect.";
    case undefined:
      return null;
    default:
      return "Une erreur est survenue. Réessayez.";
  }
}
