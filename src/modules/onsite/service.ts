import { randomUUID } from "node:crypto";
import type { ParticipantStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { generateBadge, getCurrentBadge, recordPrint } from "@/modules/badges/service";
import { enregistrerScans, marquerPresences } from "@/modules/scan/service";
import { confirmParticipant, type Actor } from "@/modules/participants/service";

/**
 * Inscription sur place (brief §5.7).
 *
 * Un seul écran, une seule suite d'opérations : retrouver ou créer, valider,
 * générer le badge, imprimer, enregistrer la présence. La cible est **moins de
 * 90 secondes par personne** ; tout ce qui pouvait être enchaîné côté serveur
 * l'est, pour que l'agent n'ait qu'un bouton à presser.
 */

export class OnsiteError extends Error {}

export interface Candidat {
  id: string;
  publicId: string;
  nom: string;
  email: string;
  telephone: string | null;
  organisation: string | null;
  pays: string;
  categorie: string;
  statut: ParticipantStatus;
  aBadge: boolean;
  aPhoto: boolean;
}

/** Statuts pour lesquels il reste quelque chose à faire à l'accueil. */
const A_TRAITER: ParticipantStatus[] = [
  "INVITED",
  "INVITATION_SENT",
  "REGISTRATION_STARTED",
  "REGISTERED",
  "CONFIRMED",
  "BADGED",
  "CHECKED_IN",
];

/**
 * Recherche à l'accueil (brief §5.7) : nom, prénom, e-mail, téléphone,
 * institution, identifiant public.
 *
 * Volontairement large et non paginée, plafonnée à quinze résultats : devant
 * une file d'attente, on tape trois lettres d'un nom et on choisit dans une
 * courte liste. Une recherche exacte obligerait à épeler une adresse.
 */
export async function rechercher(editionId: string, terme: string): Promise<Candidat[]> {
  const recherche = terme.trim();
  if (recherche.length < 2) return [];

  const participants = await prisma.participant.findMany({
    where: {
      editionId,
      deletedAt: null,
      status: { in: A_TRAITER },
      OR: [
        { firstName: { contains: recherche } },
        { lastName: { contains: recherche } },
        { email: { contains: recherche } },
        { phone: { contains: recherche } },
        { organization: { contains: recherche } },
        { publicId: { contains: recherche.toUpperCase() } },
      ],
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 15,
    select: {
      id: true,
      publicId: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      organization: true,
      country: true,
      status: true,
      photoPath: true,
      category: { select: { labelFr: true } },
      badges: { where: { revokedAt: null }, select: { id: true }, take: 1 },
    },
  });

  return participants.map((participant) => ({
    id: participant.id,
    publicId: participant.publicId,
    nom: `${participant.lastName.toUpperCase()} ${participant.firstName}`,
    email: participant.email,
    telephone: participant.phone,
    organisation: participant.organization,
    pays: participant.country,
    categorie: participant.category.labelFr,
    statut: participant.status,
    aBadge: participant.badges.length > 0,
    aPhoto: participant.photoPath !== null,
  }));
}

export interface ResultatAccueil {
  participantId: string;
  publicId: string;
  nom: string;
  badgeId: string;
  /** Vrai si le badge existait déjà : on ne le réédite pas pour rien. */
  badgeExistant: boolean;
  presenceEnregistree: boolean;
}

/**
 * Enregistre le passage à l'accueil en empruntant **le chemin des scans**.
 *
 * Une présence saisie au comptoir et une présence scannée à la porte doivent
 * être le même fait : même table, même idempotence par `clientScanId`, mêmes
 * comptages dans les rapports du jour J. Écrire une seconde voie aurait produit
 * deux vérités et un écart à expliquer.
 */
async function enregistrerPassage(
  editionId: string,
  checkpointId: string,
  qrToken: string,
  agentUserId: string | undefined,
): Promise<boolean> {
  const clientScanId = randomUUID();
  const resultat = await enregistrerScans(
    editionId,
    [
      {
        clientScanId,
        checkpointId,
        tokenHash: qrToken,
        scannedAt: new Date().toISOString(),
        direction: "IN",
        result: "OK",
      },
    ],
    agentUserId,
  );

  if (resultat.enregistres === 0) return false;
  await marquerPresences([clientScanId]).catch(() => 0);
  return true;
}

/**
 * Finalise un passage à l'accueil : validation, badge, présence.
 *
 * Tolérant à ce qui est déjà fait — un participant déjà confirmé n'est pas
 * reconfirmé, un badge valide n'est pas réédité. L'agent presse le même bouton
 * quel que soit l'état d'avancement du dossier, ce qui lui évite d'avoir à en
 * juger devant la file.
 */
export async function finaliser(
  editionId: string,
  participantId: string,
  actor: Actor,
  checkpointId: string | null,
): Promise<ResultatAccueil> {
  const participant = await prisma.participant.findFirstOrThrow({
    where: { id: participantId, deletedAt: null },
    select: { id: true, publicId: true, firstName: true, lastName: true, status: true },
  });

  if (participant.status === "CANCELLED" || participant.status === "DECLINED") {
    throw new OnsiteError(
      "Cette inscription a été annulée. Reprenez-la depuis la fiche du participant avant de délivrer un badge.",
    );
  }

  if (!["CONFIRMED", "BADGED", "CHECKED_IN"].includes(participant.status)) {
    await confirmParticipant(participantId, actor);
  }

  const existant = await getCurrentBadge(participantId);
  const badge = existant?.generatedAt ? existant : await generateBadge(participantId, actor);

  const presence = checkpointId
    ? await enregistrerPassage(editionId, checkpointId, badge.qrToken, actor.userId)
    : false;

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "onsite.finalised",
    entity: "Participant",
    entityId: participantId,
    after: {
      badgeId: badge.id,
      badgeExistant: Boolean(existant?.generatedAt),
      presenceEnregistree: presence,
    },
  });

  return {
    participantId,
    publicId: participant.publicId,
    nom: `${participant.lastName.toUpperCase()} ${participant.firstName}`,
    badgeId: badge.id,
    badgeExistant: Boolean(existant?.generatedAt),
    presenceEnregistree: presence,
  };
}

/** Compte une impression, pour que le stock de badges vierges soit suivi. */
export async function noterImpression(badgeId: string, actor: Actor): Promise<void> {
  await recordPrint(badgeId, actor);
}
