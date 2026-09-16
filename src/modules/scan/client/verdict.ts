import { evaluerAcces, type BadgeConnu, type Verdict } from "@/modules/access/decision";
import type { EntreeManifeste } from "../manifest";
import type { ScanEntry } from "../schema";
import { dernierPassage, empiler, noterPassage, vuAujourdhui } from "./store";

/**
 * Passage du manifeste à la forme que consomme la décision d'accès.
 *
 * Toute l'idée du chantier tient dans cette fonction : le scanner ne
 * réimplémente **aucune** règle. Il traduit son manifeste, puis appelle le même
 * `evaluerAcces` que le serveur.
 */
export function versBadgeConnu(entree: EntreeManifeste | null): BadgeConnu | null {
  if (!entree) return null;
  return {
    publicId: entree.publicId,
    statut: entree.statut,
    zones: entree.zones,
    alerteAccueil: entree.alerte,
    revoque: entree.revoque,
  };
}

export interface ResultatScan {
  verdict: Verdict;
  entree: EntreeManifeste | null;
  empreinte: string;
  scanneA: Date;
}

/**
 * Traite un badge lu : verdict, mise en file, mémorisation du passage.
 *
 * Le scan est empilé **quel que soit le verdict**, refus compris : un badge
 * révoqué présenté trois fois à la même porte est une information, et
 * l'effacer priverait le rapport du jour J de ce qui s'est réellement passé.
 */
export async function traiterScan(
  empreinte: string,
  entree: EntreeManifeste | null,
  checkpointId: string,
  zoneCode: string,
): Promise<ResultatScan> {
  const scanneA = new Date();
  const jour = scanneA.toISOString().slice(0, 10);

  const [precedent, dejaVu] = await Promise.all([
    dernierPassage(empreinte, checkpointId),
    vuAujourdhui(empreinte, jour),
  ]);

  const verdict = evaluerAcces(versBadgeConnu(entree), {
    zoneCode,
    scanneA,
    dernierScanIci: precedent,
    premierPassageDuJour: !dejaVu,
  });

  const scan: ScanEntry = {
    clientScanId: crypto.randomUUID(),
    checkpointId,
    tokenHash: empreinte,
    scannedAt: scanneA.toISOString(),
    direction: "IN",
    result: verdict.resultat,
  };
  await empiler(scan);

  // Le passage n'est mémorisé que s'il a été autorisé : un refus ne doit pas
  // déclencher l'anti-double-scan et faire croire, au second essai, que la
  // personne est déjà entrée.
  if (verdict.resultat === "OK") {
    await noterPassage(empreinte, checkpointId, scanneA);
  }

  return { verdict, entree, empreinte, scanneA };
}
