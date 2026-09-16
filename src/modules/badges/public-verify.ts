import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { hashBadgeToken, parseBadgeToken, verifyBadgeSignature } from "./token";

const VERIFY_LIMIT = 30;
const VERIFY_WINDOW_SECONDS = 60;

/**
 * Niveau de preuve du contrôle.
 *
 * `SIGNED` — le QR a été lu : la signature HMAC est vérifiée, le badge présenté
 * est authentique.
 * `IDENTIFIER` — l'agent a saisi l'identifiant imprimé (secours quand le QR est
 * abîmé). On confirme alors l'existence et l'état du badge, **mais pas
 * l'authenticité du support** : n'importe qui recopiant un identifiant vu
 * ailleurs obtiendrait la même réponse. La distinction est remontée jusqu'à
 * l'écran pour ne pas laisser croire à une garantie qu'on n'apporte pas.
 */
export type VerificationAssurance = "SIGNED" | "IDENTIFIER";

export interface VerifiedParticipant {
  firstName: string;
  lastName: string;
  organization: string | null;
  country: string;
  categoryLabel: string;
  publicId: string;
}

export type PublicVerification =
  | {
      status: "VALID";
      assurance: VerificationAssurance;
      participant: VerifiedParticipant;
      version: number;
      checkedIn: boolean;
    }
  | { status: "REVOKED"; assurance: VerificationAssurance; reason: string | null }
  | { status: "CANCELLED"; assurance: VerificationAssurance }
  | { status: "NOT_BADGED" }
  | { status: "UNKNOWN" }
  | { status: "RATE_LIMITED"; retryAfterSeconds: number };

const badgeInclude = {
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
} as const;

type BadgeWithParticipant = Awaited<
  ReturnType<typeof prisma.badge.findFirst<{ include: typeof badgeInclude }>>
>;

function present(
  badge: NonNullable<BadgeWithParticipant>,
  assurance: VerificationAssurance,
): PublicVerification {
  if (badge.participant.deletedAt) return { status: "UNKNOWN" };

  if (badge.revokedAt) {
    return { status: "REVOKED", assurance, reason: badge.revokeReason };
  }

  // Un badge non révoqué mais dont la participation a été annulée ne donne
  // aucun droit d'accès : le dire explicitement plutôt que d'afficher « valide ».
  if (badge.participant.status === "CANCELLED" || badge.participant.status === "DECLINED") {
    return { status: "CANCELLED", assurance };
  }

  return {
    status: "VALID",
    assurance,
    version: badge.version,
    checkedIn: badge.participant.status === "CHECKED_IN",
    participant: {
      // Jamais d'e-mail, de téléphone ni de photo (brief §2.11) : la sélection
      // Prisma ci-dessus ne les charge même pas.
      firstName: badge.participant.firstName,
      lastName: badge.participant.lastName,
      organization: badge.participant.organization,
      country: badge.participant.country,
      categoryLabel: badge.participant.category.labelFr,
      publicId: badge.participant.publicId,
    },
  };
}

/**
 * Vérification publique d'un badge (brief §5.4, §2.11).
 * Accepte indifféremment le token complet issu du QR ou l'identifiant imprimé.
 */
export async function verifyBadgePublicly(input: string, ip: string): Promise<PublicVerification> {
  const limit = await rateLimit(`badge-verify:${ip}`, VERIFY_LIMIT, VERIFY_WINDOW_SECONDS);
  if (!limit.allowed) {
    return { status: "RATE_LIMITED", retryAfterSeconds: limit.retryAfterSeconds };
  }

  const value = input.trim().toUpperCase();
  if (!value) return { status: "UNKNOWN" };

  const parsed = parseBadgeToken(value);

  // 1. Token complet : recherche par empreinte, puis contrôle de la signature.
  if (parsed) {
    const badge = await prisma.badge.findUnique({
      where: { qrToken: hashBadgeToken(`${parsed.publicId}.${parsed.signature}`) },
      include: badgeInclude,
    });
    if (!badge) return { status: "UNKNOWN" };
    if (!verifyBadgeSignature(value, badge.version)) return { status: "UNKNOWN" };
    return present(badge, "SIGNED");
  }

  // 2. Secours : identifiant imprimé seul, sans signature à vérifier.
  const participant = await prisma.participant.findUnique({
    where: { publicId: value },
    select: { id: true, deletedAt: true },
  });
  if (!participant || participant.deletedAt) return { status: "UNKNOWN" };

  const badge = await prisma.badge.findFirst({
    where: { participantId: participant.id },
    orderBy: { version: "desc" },
    include: badgeInclude,
  });
  if (!badge) return { status: "NOT_BADGED" };

  return present(badge, "IDENTIFIER");
}
