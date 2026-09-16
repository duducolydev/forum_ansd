import { z } from "zod";

/**
 * Charge utile de synchronisation des scans (brief §5.6).
 *
 * Le `clientScanId` est un UUID produit par le scanner **au moment du scan**,
 * pas à l'envoi : c'est lui qui rend la synchronisation idempotente. Un lot
 * renvoyé deux fois — réseau qui retombe en plein envoi, agent qui recharge la
 * page — ne crée pas deux présences.
 */
export const scanEntrySchema = z.object({
  clientScanId: z.uuid(),
  checkpointId: z.string().min(1).max(40),
  /** Empreinte SHA-256 du token QR, telle que calculée par le scanner. */
  tokenHash: z.string().regex(/^[a-f0-9]{64}$/, "Empreinte invalide"),
  scannedAt: z.iso.datetime(),
  direction: z.enum(["IN", "OUT"]),
  result: z.enum(["OK", "ALREADY", "DENIED_ZONE", "DENIED_STATUS", "REVOKED", "UNKNOWN"]),
});

export type ScanEntry = z.infer<typeof scanEntrySchema>;

/**
 * Lot plafonné à 200 : c'est le volume de la file annoncé par le critère
 * d'acceptation, et un plafond évite qu'un appareil resté trois jours hors
 * ligne n'envoie une requête que le serveur refuserait en bloc. Au-delà, le
 * scanner découpe.
 */
export const syncPayloadSchema = z.object({
  scans: z.array(scanEntrySchema).min(1).max(200),
});

export type SyncPayload = z.infer<typeof syncPayloadSchema>;
