import type { Manifeste } from "../manifest";
import { depiler, lireFile, lireMeta, marquerSynchronise, remplacerManifeste } from "./store";

/** Taille d'un envoi. Le serveur plafonne à 200 ; on garde une marge. */
const LOT = 100;

export type EtatSync =
  | { etat: "A_JOUR"; entrees: number }
  | { etat: "MIS_A_JOUR"; entrees: number }
  | { etat: "HORS_LIGNE" }
  | { etat: "ERREUR"; message: string };

/**
 * Récupère le manifeste si le serveur en a un plus récent.
 *
 * L'ETag évite de retélécharger un manifeste inchangé — ce qui est le cas le
 * plus fréquent, le rafraîchissement ayant lieu toutes les dix minutes.
 */
export async function synchroniserManifeste(): Promise<EtatSync> {
  const meta = await lireMeta();

  let reponse: Response;
  try {
    reponse = await fetch("/api/v1/scan/manifest", {
      headers: meta?.etag ? { "If-None-Match": meta.etag } : {},
      cache: "no-store",
    });
  } catch {
    return { etat: "HORS_LIGNE" };
  }

  if (reponse.status === 304) {
    await marquerSynchronise();
    return { etat: "A_JOUR", entrees: meta?.entrees ?? 0 };
  }

  if (!reponse.ok) {
    return {
      etat: "ERREUR",
      message:
        reponse.status === 401
          ? "Session expirée : reconnectez-vous."
          : `Le serveur a répondu ${reponse.status}.`,
    };
  }

  const manifeste = (await reponse.json()) as Manifeste;
  await remplacerManifeste(manifeste, reponse.headers.get("etag"));
  return { etat: "MIS_A_JOUR", entrees: manifeste.entrees.length };
}

export interface ResultatEnvoi {
  envoyes: number;
  restants: number;
  horsLigne: boolean;
}

/**
 * Vide la file vers le serveur, par lots.
 *
 * Les scans ne sont retirés de la file **qu'après** une réponse favorable. Une
 * coupure en plein envoi laisse donc le lot en place ; il repartira, et
 * l'unicité de `clientScanId` empêchera le doublon côté serveur.
 */
export async function envoyerFile(): Promise<ResultatEnvoi> {
  const file = await lireFile();
  if (file.length === 0) return { envoyes: 0, restants: 0, horsLigne: false };

  let envoyes = 0;

  for (let debut = 0; debut < file.length; debut += LOT) {
    const lot = file.slice(debut, debut + LOT);

    let reponse: Response;
    try {
      reponse = await fetch("/api/v1/scan/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scans: lot }),
      });
    } catch {
      return { envoyes, restants: file.length - envoyes, horsLigne: true };
    }

    if (!reponse.ok) {
      return { envoyes, restants: file.length - envoyes, horsLigne: false };
    }

    await depiler(lot.map((scan) => scan.clientScanId));
    envoyes += lot.length;
  }

  return { envoyes, restants: 0, horsLigne: false };
}
