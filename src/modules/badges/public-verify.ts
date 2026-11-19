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
  civility: string | null;
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
  /**
   * Badge anonyme valide — une carte du stock de secours, remise sur place.
   *
   * Statut **distinct** de `VALID`, et non un `VALID` au porteur vide : l'agent
   * doit savoir qu'aucun nom n'est attaché à ce badge, pour le confronter à la
   * personne qui le présente. Un « valide » suivi d'un cadre vide se lirait
   * comme un défaut d'affichage, et c'est précisément le cas où il ne faut pas
   * hésiter.
   */
  | {
      status: "VALID_ANONYME";
      assurance: VerificationAssurance;
      categoryLabel: string;
      /** Numéro imprimé sur la carte, à confronter au registre de remise. */
      numero: number | null;
      reference: string;
      version: number;
    }
  | { status: "REVOKED"; assurance: VerificationAssurance; reason: string | null }
  | { status: "CANCELLED"; assurance: VerificationAssurance }
  | { status: "NOT_BADGED" }
  | { status: "UNKNOWN" }
  | { status: "RATE_LIMITED"; retryAfterSeconds: number };

const badgeInclude = {
  anonymousCategory: { select: { labelFr: true } },
  participant: {
    select: {
      civility: true,
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

/**
 * Le verdict rendu à l'agent, à partir d'un badge déjà retrouvé.
 *
 * Exporté pour être éprouvé seul : c'est la fonction qui décide si quelqu'un
 * entre, et elle ne doit pas n'être atteignable qu'au travers d'une base de
 * données. L'ordre de ses contrôles est significatif — voir les commentaires.
 */
export function verdictDuBadge(
  badge: NonNullable<BadgeWithParticipant>,
  assurance: VerificationAssurance,
): PublicVerification {
  /*
   * La révocation passe **avant** le tri entre badge nominatif et badge
   * anonyme : un badge retiré doit s'annoncer retiré dans les deux cas, et
   * l'ordre des contrôles de cette fonction est significatif (cf. `evaluerAcces`).
   */
  if (badge.revokedAt) {
    return { status: "REVOKED", assurance, reason: badge.revokeReason };
  }

  if (!badge.participant) {
    // Badge anonyme : il n'a de sens que porté par sa catégorie et son numéro.
    if (!badge.anonymousCategory || !badge.anonymousRef) return { status: "UNKNOWN" };
    return {
      status: "VALID_ANONYME",
      assurance,
      categoryLabel: badge.anonymousCategory.labelFr,
      numero: badge.anonymousSeq,
      reference: badge.anonymousRef,
      version: badge.version,
    };
  }

  if (badge.participant.deletedAt) return { status: "UNKNOWN" };

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
      civility: badge.participant.civility,
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
    return verdictDuBadge(badge, "SIGNED");
  }

  /*
   * 2. Secours : identifiant imprimé seul, sans signature à vérifier.
   *
   * Un badge anonyme porte sa propre référence et pas un `publicId` de
   * participant : la chercher d'abord évite qu'un QR abîmé sur une carte de
   * secours — le support le plus manipulé de la journée — ne réponde
   * « inconnu » à l'agent.
   */
  const anonyme = await prisma.badge.findUnique({
    where: { anonymousRef: value },
    include: badgeInclude,
  });
  if (anonyme) return verdictDuBadge(anonyme, "IDENTIFIER");

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

  return verdictDuBadge(badge, "IDENTIFIER");
}
