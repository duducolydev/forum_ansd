import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { fileStorage } from "@/lib/storage";

/**
 * Photo de profil du participant (brief §5.3), reprise sur le badge (§5.4).
 *
 * Le recadrage carré est fait par le navigateur ; le serveur ne fait pas
 * confiance à ce qu'il reçoit pour autant : le type est déduit des **octets du
 * fichier**, jamais de l'en-tête `Content-Type` que le client déclare.
 */
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

export type PhotoRejection =
  { status: "TOO_LARGE"; maxBytes: number } | { status: "UNSUPPORTED_TYPE" } | { status: "EMPTY" };

export type PhotoResult = { status: "OK"; path: string } | PhotoRejection;

/** Signatures de fichier des seuls formats acceptés. */
const SIGNATURES: { extension: string; type: string; test: (b: Buffer) => boolean }[] = [
  {
    extension: "jpg",
    type: "image/jpeg",
    test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    extension: "png",
    type: "image/png",
    test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d,
  },
  {
    extension: "webp",
    type: "image/webp",
    test: (b) =>
      b.subarray(0, 4).toString("ascii") === "RIFF" &&
      b.subarray(8, 12).toString("ascii") === "WEBP",
  },
];

/**
 * Type réel du fichier, déduit de ses premiers octets.
 *
 * Un fichier peut annoncer `image/jpeg` et contenir tout autre chose : c'est la
 * façon la plus courante de déposer un contenu inattendu par un formulaire
 * d'upload. Seuls les trois formats reconnus ici sont acceptés.
 */
export function detectImageType(data: Buffer): { extension: string; type: string } | null {
  if (data.length < 12) return null;
  return SIGNATURES.find((signature) => signature.test(data)) ?? null;
}

/**
 * Enregistre la photo et met à jour le participant.
 *
 * Le nom de fichier porte un suffixe aléatoire plutôt que d'écraser le
 * précédent : un remplacement produit une nouvelle URL, ce qui évite qu'un
 * cache serve l'ancienne image. L'ancien fichier est supprimé dans la foulée.
 */
export async function saveParticipantPhoto(
  participantId: string,
  file: File,
): Promise<PhotoResult> {
  if (file.size === 0) return { status: "EMPTY" };
  if (file.size > PHOTO_MAX_BYTES) {
    return { status: "TOO_LARGE", maxBytes: PHOTO_MAX_BYTES };
  }

  const data = Buffer.from(await file.arrayBuffer());
  const detected = detectImageType(data);
  if (!detected) return { status: "UNSUPPORTED_TYPE" };

  const participant = await prisma.participant.findUniqueOrThrow({
    where: { id: participantId },
    select: { publicId: true, photoPath: true },
  });

  const path = `photos/${participant.publicId}-${randomBytes(6).toString("hex")}.${detected.extension}`;
  await fileStorage.put(path, data, detected.type);

  await prisma.participant.update({ where: { id: participantId }, data: { photoPath: path } });

  if (participant.photoPath && participant.photoPath !== path) {
    await fileStorage.delete(participant.photoPath).catch(() => undefined);
  }

  await audit.log({
    actorType: "PARTICIPANT",
    actorParticipantId: participantId,
    action: "participant.photo_updated",
    entity: "Participant",
    entityId: participantId,
    after: { type: detected.type, bytes: data.length },
  });

  return { status: "OK", path };
}

/** Suppression de la photo — droit d'opposition sur l'image (brief §7). */
export async function removeParticipantPhoto(participantId: string): Promise<void> {
  const participant = await prisma.participant.findUniqueOrThrow({
    where: { id: participantId },
    select: { photoPath: true },
  });
  if (!participant.photoPath) return;

  await prisma.participant.update({ where: { id: participantId }, data: { photoPath: null } });
  await fileStorage.delete(participant.photoPath).catch(() => undefined);

  await audit.log({
    actorType: "PARTICIPANT",
    actorParticipantId: participantId,
    action: "participant.photo_removed",
    entity: "Participant",
    entityId: participantId,
  });
}
