/**
 * Photo affichée pour un intervenant : celle de sa fiche, sinon celle du
 * participant auquel il est rattaché (5 novembre 2026).
 *
 * Les cartes du site ne lisaient que la première. Or un intervenant inscrit au
 * Forum dépose souvent sa photo comme participant — à l'inscription ou dans
 * « Mon espace » — et jamais dans son espace intervenant : sa carte restait
 * sur ses initiales, alors que son badge, lui, portait bien sa photo. C'est le
 * pendant de `civiliteIntervenant`, et le badge fait déjà le chemin inverse
 * (`badges/service.ts`).
 *
 * Servie publiquement par `/api/v1/speakers/[id]/photo` **seulement si la
 * fiche est publiée**, comme la photo de la fiche elle-même : c'est la décision
 * du comité de mettre la personne au programme qui la rend publique.
 *
 * Sans dépendance, pour rester importable côté navigateur.
 */
export function photoIntervenant(speaker: {
  photoPath?: string | null;
  participant?: { photoPath?: string | null } | null;
}): string | null {
  return speaker.photoPath || speaker.participant?.photoPath || null;
}

/** D'où vient la photo affichée, pour le dire au comité. */
export function originePhotoIntervenant(speaker: {
  photoPath?: string | null;
  participant?: { photoPath?: string | null } | null;
}): "fiche" | "participant" | null {
  if (speaker.photoPath) return "fiche";
  if (speaker.participant?.photoPath) return "participant";
  return null;
}

/**
 * Adresse de la photo d'un intervenant, ou `null` sans photo.
 *
 * Le suffixe `?v=` reprend la partie aléatoire du nom de fichier, qui change à
 * chaque dépôt : la route publique met l'image en cache dix minutes, et une
 * photo remplacée par le comité doit s'afficher tout de suite (9 novembre
 * 2026). La route l'ignore.
 *
 * C'est cette adresse, et non le chemin de stockage, qui va au navigateur : pour
 * une photo de participant, le chemin porte son identifiant public de badge.
 */
export function urlPhotoIntervenant(speaker: {
  id: string;
  photoPath?: string | null;
  participant?: { photoPath?: string | null } | null;
}): string | null {
  const chemin = photoIntervenant(speaker);
  if (!chemin) return null;
  const version = /-([0-9a-f]+)\.[a-z0-9]+$/i.exec(chemin)?.[1];
  return `/api/v1/speakers/${speaker.id}/photo${version ? `?v=${version}` : ""}`;
}
