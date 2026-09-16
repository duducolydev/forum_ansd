import type { Badge, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { fileStorage } from "@/lib/storage";
import { generateQrDataUrl } from "@/lib/qr";
import { renderHtmlToPdfAndPng } from "@/lib/pdf";
import { enqueueNotification } from "@/modules/notifications/jobs";
import { markBadged, type Actor } from "@/modules/participants/service";
import { InvalidParticipantTransitionError } from "@/modules/participants/errors";
import { renderBadgeHtml } from "./template";
import { buildBadgeToken, hashBadgeToken, parseBadgeToken, verifyBadgeSignature } from "./token";

/** Sélection minimale nécessaire au rendu — évite de charger tout le participant. */
const participantForBadge = {
  id: true,
  publicId: true,
  firstName: true,
  lastName: true,
  jobTitle: true,
  organization: true,
  country: true,
  email: true,
  locale: true,
  status: true,
  photoPath: true,
  editionId: true,
  category: { select: { labelFr: true, labelEn: true, color: true } },
  edition: { select: { title: true } },
} satisfies Prisma.ParticipantSelect;

async function photoDataUrl(photoPath: string | null): Promise<string | null> {
  if (!photoPath) return null;
  try {
    const buffer = await fileStorage.get(photoPath);
    const type = photoPath.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
    return `data:${type};base64,${buffer.toString("base64")}`;
  } catch {
    // Photo introuvable : on retombe sur les initiales plutôt que d'échouer
    // la génération d'un badge par ailleurs valide.
    return null;
  }
}

function storageKey(publicId: string, version: number, extension: string): string {
  return `badges/${publicId}/v${version}.${extension}`;
}

/**
 * Rend le badge et écrit les fichiers. Ne touche ni au statut du participant
 * ni aux notifications : c'est `generateBadge` qui orchestre.
 */
async function renderAndStore(badge: Badge): Promise<{ pdfPath: string; pngPath: string }> {
  const participant = await prisma.participant.findUniqueOrThrow({
    where: { id: badge.participantId },
    select: participantForBadge,
  });

  const token = buildBadgeToken(participant.publicId, badge.version);
  const baseUrl = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";

  const html = renderBadgeHtml({
    editionName: participant.edition.title,
    firstName: participant.firstName,
    lastName: participant.lastName,
    jobTitle: participant.jobTitle,
    organization: participant.organization,
    country: participant.country,
    categoryLabel: participant.category.labelFr,
    categoryColor: participant.category.color,
    publicId: participant.publicId,
    // Le QR encode l'URL de vérification publique : un scanner générique
    // (appareil photo de téléphone) ouvre directement la page de contrôle.
    qrDataUrl: await generateQrDataUrl(`${baseUrl}/v/${token}`),
    photoDataUrl: await photoDataUrl(participant.photoPath),
  });

  const { pdf, png } = await renderHtmlToPdfAndPng(html, { format: "CR80" }, { width: 1200 });

  const pdfPath = storageKey(participant.publicId, badge.version, "pdf");
  const pngPath = storageKey(participant.publicId, badge.version, "png");
  await fileStorage.put(pdfPath, pdf, "application/pdf");
  await fileStorage.put(pngPath, png, "image/png");

  return { pdfPath, pngPath };
}

export async function getCurrentBadge(participantId: string): Promise<Badge | null> {
  return prisma.badge.findFirst({
    where: { participantId, revokedAt: null },
    orderBy: { version: "desc" },
  });
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002"
  );
}

/**
 * Crée la ligne `Badge` d'une version donnée, ou renvoie celle qui existe déjà.
 *
 * La génération peut être déclenchée deux fois de front — le job posé à la
 * confirmation et un clic dans le BackOffice — et un simple « vérifier puis
 * créer » viole alors `Badge_qrToken_key`. L'`upsert` de Prisma ne suffit pas
 * ici (sur MySQL il se traduit par un SELECT puis un INSERT, donc reste
 * sujet à la même course) : on rattrape explicitement la collision. Le
 * `qrToken` étant déterministe pour un couple (publicId, version), il fait
 * office de clé naturelle.
 */
async function ensureBadgeRow(
  participantId: string,
  publicId: string,
  version: number,
): Promise<Badge> {
  const qrToken = hashBadgeToken(buildBadgeToken(publicId, version));

  const existing = await prisma.badge.findUnique({ where: { qrToken } });
  if (existing) return existing;

  try {
    return await prisma.badge.create({
      data: { participant: { connect: { id: participantId } }, version, qrToken },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return prisma.badge.findUniqueOrThrow({ where: { qrToken } });
    }
    throw error;
  }
}

/**
 * Génère (ou régénère) le badge courant d'un participant. Idempotent au sens
 * utile : rappelé sur un badge déjà généré, il refait le rendu à la même
 * version — c'est le cas « la photo a changé », pas une réémission.
 */
export async function generateBadge(
  participantId: string,
  actor: Actor = { type: "SYSTEM" },
): Promise<Badge> {
  const participant = await prisma.participant.findUniqueOrThrow({
    where: { id: participantId },
    select: participantForBadge,
  });

  // On regarde le dernier badge **quel que soit son état** : se limiter aux
  // badges actifs ferait recréer une v1 déjà révoquée, en collision avec elle.
  const latest = await prisma.badge.findFirst({
    where: { participantId },
    orderBy: { version: "desc" },
  });

  if (latest?.revokedAt) {
    throw new Error(
      `Le badge v${latest.version} a été révoqué : utiliser la réémission (version ${latest.version + 1}) plutôt que la régénération.`,
    );
  }

  const badge = latest ?? (await ensureBadgeRow(participantId, participant.publicId, 1));

  const { pdfPath, pngPath } = await renderAndStore(badge);
  const updated = await prisma.badge.update({
    where: { id: badge.id },
    data: { pdfPath, pngPath, generatedAt: new Date(), generatedById: actor.userId ?? null },
  });

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    actorParticipantId: actor.participantId,
    action: "badge.generated",
    entity: "Badge",
    entityId: updated.id,
    after: { version: updated.version, participantId },
  });

  // Le passage à BADGED n'a de sens qu'au premier badge : une régénération ne
  // doit pas faire régresser un participant déjà CHECKED_IN. Le statut est
  // relu ici et non réutilisé depuis le début de la fonction : le rendu dure
  // quelques centaines de millisecondes, pendant lesquelles une génération
  // concurrente a pu déjà faire la transition.
  const { status } = await prisma.participant.findUniqueOrThrow({
    where: { id: participantId },
    select: { status: true },
  });
  if (status === "CONFIRMED") {
    try {
      await markBadged(participantId, actor);
    } catch (error) {
      // Transition refusée = quelqu'un d'autre l'a faite entre-temps. Le but
      // (participant badgé) est atteint : inutile d'échouer la génération.
      if (!(error instanceof InvalidParticipantTransitionError)) throw error;
    }
  }

  const baseUrl = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
  await enqueueNotification(
    {
      editionId: participant.editionId,
      templateKey: "badge_ready",
      to: participant.email,
      participantId,
      variables: { prenom: participant.firstName, lien_badge: `${baseUrl}/mon-espace` },
    },
    `badge-ready-${updated.id}-v${updated.version}`,
  );

  return updated;
}

/** Révocation : l'ancien QR devient invalide immédiatement (brief §5.4). */
export async function revokeBadge(badgeId: string, reason: string, actor: Actor): Promise<Badge> {
  const badge = await prisma.badge.findUniqueOrThrow({ where: { id: badgeId } });
  if (badge.revokedAt) return badge;

  const updated = await prisma.badge.update({
    where: { id: badgeId },
    data: { revokedAt: new Date(), revokeReason: reason },
  });

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "badge.revoked",
    entity: "Badge",
    entityId: badgeId,
    before: { revokedAt: null },
    after: { revokedAt: updated.revokedAt, reason },
  });

  return updated;
}

/**
 * Réémission : révoque le badge courant puis en génère un de version+1.
 * Le token change (la version entre dans le HMAC), donc l'ancien QR ne
 * correspond plus — vérifié par un test.
 */
export async function reissueBadge(
  participantId: string,
  reason: string,
  actor: Actor,
): Promise<Badge> {
  const current = await getCurrentBadge(participantId);
  if (current) {
    await revokeBadge(current.id, reason, actor);
  }

  const participant = await prisma.participant.findUniqueOrThrow({
    where: { id: participantId },
    select: { publicId: true },
  });
  const version = (current?.version ?? 0) + 1;

  const badge = await ensureBadgeRow(participantId, participant.publicId, version);

  const { pdfPath, pngPath } = await renderAndStore(badge);
  const updated = await prisma.badge.update({
    where: { id: badge.id },
    data: { pdfPath, pngPath, generatedAt: new Date(), generatedById: actor.userId ?? null },
  });

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "badge.reissued",
    entity: "Badge",
    entityId: updated.id,
    after: { version, participantId, reason },
  });

  return updated;
}

/** Compteur d'impressions (brief §5.4) — incrémenté par le BackOffice. */
export async function recordPrint(badgeId: string, actor: Actor): Promise<Badge> {
  const updated = await prisma.badge.update({
    where: { id: badgeId },
    data: { printedAt: new Date(), printedCount: { increment: 1 } },
  });

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "badge.printed",
    entity: "Badge",
    entityId: badgeId,
    after: { printedCount: updated.printedCount },
  });

  return updated;
}

export async function recordDownload(badgeId: string): Promise<void> {
  await prisma.badge.update({ where: { id: badgeId }, data: { downloadedAt: new Date() } });
}

// ---------------------------------------------------------------------------
// Vérification (consommée par le scanner Lot 2 et la page publique — PLAN 3.7)
// ---------------------------------------------------------------------------

export type BadgeVerification =
  | {
      status: "VALID";
      participant: {
        firstName: string;
        lastName: string;
        organization: string | null;
        country: string;
        categoryLabel: string;
        publicId: string;
        status: string;
      };
      version: number;
    }
  | { status: "REVOKED"; reason: string | null }
  | { status: "UNKNOWN" };

/**
 * Vérifie un token de badge. Deux contrôles indépendants :
 *   1. la signature HMAC (le token n'a pas été fabriqué sans le secret) ;
 *   2. l'existence en base par empreinte, qui donne l'état (révoqué ou non).
 *
 * Un badge révoqué renvoie explicitement `REVOKED` et non `UNKNOWN` : l'agent
 * de contrôle doit pouvoir distinguer « faux badge » de « badge retiré ».
 */
export async function verifyBadgeToken(token: string): Promise<BadgeVerification> {
  const parsed = parseBadgeToken(token);
  if (!parsed) return { status: "UNKNOWN" };

  const badge = await prisma.badge.findUnique({
    where: { qrToken: hashBadgeToken(`${parsed.publicId}.${parsed.signature}`) },
    include: {
      participant: {
        select: {
          firstName: true,
          lastName: true,
          organization: true,
          country: true,
          publicId: true,
          status: true,
          deletedAt: true,
          category: { select: { labelFr: true } },
        },
      },
    },
  });

  if (!badge || badge.participant.deletedAt) return { status: "UNKNOWN" };
  if (!verifyBadgeSignature(token, badge.version)) return { status: "UNKNOWN" };
  if (badge.revokedAt) return { status: "REVOKED", reason: badge.revokeReason };

  return {
    status: "VALID",
    version: badge.version,
    participant: {
      firstName: badge.participant.firstName,
      lastName: badge.participant.lastName,
      organization: badge.participant.organization,
      country: badge.participant.country,
      categoryLabel: badge.participant.category.labelFr,
      publicId: badge.participant.publicId,
      status: badge.participant.status,
    },
  };
}
