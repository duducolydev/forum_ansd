import { createHash } from "node:crypto";
import type { ParticipantStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { resoudreZones } from "@/modules/access/decision";

/**
 * Manifeste hors ligne du scanner (brief §5.6, PLAN.md C9 à C11).
 *
 * Trois écarts assumés au brief, chacun pour une raison :
 *
 * 1. **Aucune clé de signature n'est envoyée au client.** Le brief demande une
 *    vérification HMAC côté scanner « avec une clé dérivée valable 24 h ». Le
 *    HMAC est symétrique : cette clé permettrait aussi de **fabriquer** des
 *    badges, pendant 24 h, à qui accède à l'appareil d'un agent. Le manifeste
 *    transporte donc l'**empreinte SHA-256 du token** (celle déjà stockée en
 *    base, `Badge.qrToken`) ; le scanner hache le QR lu et cherche l'empreinte.
 *    Vérification hors ligne complète, forgerie impossible, aucun secret sorti
 *    du serveur.
 * 2. **Pas de chiffrement décoratif.** Chiffrer le manifeste supposerait une clé
 *    embarquée dans l'application, donc lisible. La protection réelle est
 *    ailleurs : agent authentifié, IndexedDB cloisonnée par origine, et contenu
 *    réduit — ni e-mail, ni téléphone (§2.11).
 * 3. **Aucune photo.** À 1 500 participants, une miniature par personne pèse
 *    ~8 Mo par cycle et par appareil, toutes les 10 minutes, sur six postes :
 *    intenable sur la connexion d'un site de conférence. Les photos sont
 *    servies à la demande, en cache navigateur, et n'entrent jamais dans le
 *    chemin du verdict.
 *
 * Le manifeste est envoyé **entier**, avec un ETag : à ce format, 1 500
 * participants tiennent dans quelques dizaines de kilo-octets une fois
 * compressés, et un manifeste inchangé coûte un 304 sans corps. Un protocole
 * différentiel aurait ajouté de la complexité — et un risque de dérive entre
 * les appareils — pour un gain nul.
 */

/** Une entrée par **version de badge**, pas par participant : cf. `revoque`. */
export interface EntreeManifeste {
  /** Empreinte SHA-256 du token QR, en hexadécimal. Clé de recherche. */
  h: string;
  publicId: string;
  nom: string;
  organisation: string | null;
  categorie: string;
  /** Codes des zones autorisées, matrice et exceptions déjà résolues. */
  zones: string[];
  statut: ParticipantStatus;
  /** Catégorie à accueillir : fait passer le verdict en orange. */
  alerte: boolean;
  revoque: boolean;
  /** Une photo existe et peut être demandée à la volée. */
  photo: boolean;
}

export interface Manifeste {
  edition: string;
  genereLe: string;
  zones: { code: string; name: string }[];
  checkpoints: { id: string; name: string; zoneCode: string; deviceLabel: string | null }[];
  entrees: EntreeManifeste[];
}

/**
 * Statuts dont le badge mérite d'être embarqué.
 *
 * Plus large que `STATUTS_ADMIS` de `decision.ts`, à dessein : une inscription
 * annulée dont le badge a été imprimé doit produire un refus **explicite**, pas
 * un « badge inconnu » qui laisserait croire à une erreur de lecture.
 */
const STATUTS_EMBARQUES: ParticipantStatus[] = [
  "CONFIRMED",
  "BADGED",
  "CHECKED_IN",
  "CANCELLED",
  "DECLINED",
];

export async function buildManifeste(editionId: string, editionCode: string): Promise<Manifeste> {
  const [zones, checkpoints, participants] = await Promise.all([
    prisma.zone.findMany({
      where: { editionId },
      orderBy: { code: "asc" },
      select: { code: true, name: true },
    }),
    prisma.checkpoint.findMany({
      where: { editionId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, deviceLabel: true, zone: { select: { code: true } } },
    }),
    prisma.participant.findMany({
      where: {
        editionId,
        deletedAt: null,
        status: { in: STATUTS_EMBARQUES },
        badges: { some: {} },
      },
      // Projection étroite et volontaire : ni e-mail, ni téléphone, ni notes.
      // Ce qui n'est pas lu ici ne peut pas fuiter avec un appareil perdu.
      select: {
        publicId: true,
        firstName: true,
        lastName: true,
        organization: true,
        status: true,
        photoPath: true,
        category: {
          select: {
            labelFr: true,
            alertOnScan: true,
            categoryZones: { select: { zone: { select: { code: true } } } },
          },
        },
        zoneOverrides: { select: { zone: { select: { code: true } } } },
        badges: {
          orderBy: { version: "desc" },
          select: { qrToken: true, version: true, revokedAt: true },
        },
      },
    }),
  ]);

  const entrees: EntreeManifeste[] = [];

  for (const participant of participants) {
    const zonesResolues = resoudreZones(
      participant.category.categoryZones.map((lien) => lien.zone.code),
      participant.zoneOverrides.map((exception) => exception.zone.code),
    );
    const versionCourante = participant.badges[0]?.version ?? 0;

    for (const badge of participant.badges) {
      entrees.push({
        h: badge.qrToken,
        publicId: participant.publicId,
        nom: `${participant.firstName} ${participant.lastName}`,
        organisation: participant.organization,
        categorie: participant.category.labelFr,
        zones: zonesResolues,
        statut: participant.status,
        alerte: participant.category.alertOnScan,
        // Une version antérieure vaut révocation : c'est ce qui rend un badge
        // réédité inutilisable, et l'agent doit lire « révoqué », pas « inconnu ».
        revoque: badge.revokedAt !== null || badge.version < versionCourante,
        photo: participant.photoPath !== null,
      });
    }
  }

  entrees.sort((a, b) => a.h.localeCompare(b.h));

  return {
    edition: editionCode,
    genereLe: new Date().toISOString(),
    zones,
    checkpoints: checkpoints.map((checkpoint) => ({
      id: checkpoint.id,
      name: checkpoint.name,
      zoneCode: checkpoint.zone.code,
      deviceLabel: checkpoint.deviceLabel,
    })),
    entrees,
  };
}

/**
 * ETag du manifeste, calculé sur tout **sauf** l'horodatage de génération.
 *
 * Sans cette exclusion l'ETag changerait à chaque appel et le 304 ne servirait
 * jamais : chaque appareil re-téléchargerait le manifeste entier toutes les dix
 * minutes, ce que ce mécanisme existe précisément pour éviter.
 */
export function etagManifeste(manifeste: Manifeste): string {
  const { genereLe: _ignore, ...stable } = manifeste;
  return `"${createHash("sha256").update(JSON.stringify(stable)).digest("hex").slice(0, 32)}"`;
}
