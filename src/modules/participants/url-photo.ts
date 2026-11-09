/**
 * Adresse de la photo d'un participant, ou `null` sans photo.
 *
 * La route interdit le cache, mais certains navigateurs gardent l'ancienne image
 * après un remplacement : l'adresse change donc avec le fichier, dont le nom se
 * termine par une partie aléatoire. Réservée au participant et au BackOffice.
 */
export function urlPhotoParticipant(participant: {
  id: string;
  photoPath: string | null;
}): string | null {
  if (!participant.photoPath) return null;
  const version = participant.photoPath.split("-").pop()?.split(".")[0];
  return `/api/v1/participants/${participant.id}/photo${version ? `?v=${version}` : ""}`;
}
