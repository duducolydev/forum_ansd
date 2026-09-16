import type { Prisma, ScanResult } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { ScanEntry } from "./schema";

export interface ResultatSync {
  recus: number;
  enregistres: number;
  /** Déjà présents en base : lot renvoyé, rien à faire. */
  doublons: number;
  /** Rejetés : point de contrôle inconnu de cette édition. */
  rejetes: number;
}

/**
 * Le jour de présence, au sens des tableaux du §5.6.
 *
 * Le Forum se tient à Dakar, dont le fuseau est UTC toute l'année : la partie
 * date de l'horodatage UTC est donc bien la journée vécue sur place. Écrit ici
 * explicitement pour que le jour où une édition se tiendrait ailleurs, on tombe
 * sur ce commentaire plutôt que sur un décalage silencieux.
 */
function jourDeScan(scanneA: Date): Date {
  return new Date(Date.UTC(scanneA.getUTCFullYear(), scanneA.getUTCMonth(), scanneA.getUTCDate()));
}

/**
 * Enregistre un lot de scans remontés par un appareil.
 *
 * Le verdict retenu est **celui du scanner**, pas une réévaluation au moment de
 * la synchronisation : c'est sur ce verdict que l'agent a agi, et un badge
 * révoqué dix minutes après le passage ne doit pas transformer rétroactivement
 * une entrée autorisée en refus. Le serveur n'ajoute qu'un garde-fou : si
 * l'empreinte lui est inconnue, le résultat est ramené à `UNKNOWN`, car aucun
 * participant ne peut y être rattaché.
 */
export async function enregistrerScans(
  editionId: string,
  scans: ScanEntry[],
  agentUserId: string | undefined,
): Promise<ResultatSync> {
  const empreintes = [...new Set(scans.map((scan) => scan.tokenHash))];
  const identifiantsPoints = [...new Set(scans.map((scan) => scan.checkpointId))];

  const [badges, points] = await Promise.all([
    prisma.badge.findMany({
      where: { qrToken: { in: empreintes } },
      select: { id: true, participantId: true, version: true, qrToken: true },
    }),
    prisma.checkpoint.findMany({
      where: { id: { in: identifiantsPoints }, editionId },
      select: { id: true },
    }),
  ]);

  const parEmpreinte = new Map(badges.map((badge) => [badge.qrToken, badge]));
  const pointsValides = new Set(points.map((point) => point.id));

  const lignes: Prisma.ScanLogCreateManyInput[] = [];
  let rejetes = 0;

  for (const scan of scans) {
    if (!pointsValides.has(scan.checkpointId)) {
      rejetes++;
      continue;
    }

    const badge = parEmpreinte.get(scan.tokenHash);
    const scanneA = new Date(scan.scannedAt);

    lignes.push({
      clientScanId: scan.clientScanId,
      checkpointId: scan.checkpointId,
      participantId: badge?.participantId ?? null,
      badgeId: badge?.id ?? null,
      badgeVersion: badge?.version ?? 0,
      agentUserId: agentUserId ?? null,
      scannedAt: scanneA,
      day: jourDeScan(scanneA),
      direction: scan.direction,
      result: (badge ? scan.result : "UNKNOWN") as ScanResult,
      syncedAt: new Date(),
    });
  }

  // `skipDuplicates` s'appuie sur l'unicité de `clientScanId` : c'est ce qui
  // rend un renvoi de lot inoffensif, sans lecture préalable ni transaction.
  const { count } = await prisma.scanLog.createMany({ data: lignes, skipDuplicates: true });

  return {
    recus: scans.length,
    enregistres: count,
    doublons: lignes.length - count,
    rejetes,
  };
}

/**
 * Passe à `CHECKED_IN` les participants entrés pour la première fois.
 *
 * Séparé de l'enregistrement des scans, et volontairement tolérant : un statut
 * qui n'accepte pas la transition (annulation entre-temps, par exemple) ne doit
 * pas faire échouer la synchronisation d'un lot entier de présences.
 */
export async function marquerPresences(clientScanIds: string[]): Promise<number> {
  if (clientScanIds.length === 0) return 0;

  const scans = await prisma.scanLog.findMany({
    where: { clientScanId: { in: clientScanIds }, result: "OK", direction: "IN" },
    select: { participantId: true },
  });

  const identifiants = [
    ...new Set(scans.map((scan) => scan.participantId).filter((id): id is string => id !== null)),
  ];
  if (identifiants.length === 0) return 0;

  const { count } = await prisma.participant.updateMany({
    where: { id: { in: identifiants }, status: { in: ["CONFIRMED", "BADGED"] } },
    data: { status: "CHECKED_IN" },
  });

  return count;
}
