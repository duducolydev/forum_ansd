/**
 * Nom de famille en capitales (demande du 29 octobre 2026) : « Diop » devient
 * « DIOP », « Diène » « DIÈNE ». Appliqué par chaque schéma qui reçoit un nom
 * — inscription, BackOffice, « Mon espace », invitations, intervenants,
 * imports —, si bien qu'un nom n'entre en base qu'en majuscules. Les accents
 * sont gardés.
 */
export function nomDeFamille(valeur: string): string {
  return valeur.toLocaleUpperCase("fr-FR");
}
