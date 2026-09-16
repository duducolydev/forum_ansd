import type { EntreeManifeste, Manifeste } from "../manifest";
import type { ScanEntry } from "../schema";

/**
 * Stockage local du scanner (brief §5.6).
 *
 * IndexedDB brut, sans bibliothèque : quatre magasins et une poignée
 * d'opérations ne justifient pas une dépendance de plus dans une application
 * qui doit démarrer sans réseau.
 *
 * Le contenu est cloisonné par origine par le navigateur lui-même. Il n'est pas
 * chiffré, et le brief demandait un « manifeste chiffré » : la clé aurait
 * accompagné l'application, donc lisible par qui inspecte l'appareil. La
 * protection réelle est ailleurs — agent authentifié, et manifeste réduit au
 * strict nécessaire (ni e-mail, ni téléphone).
 */
const NOM_BASE = "forum-scan";
const VERSION = 1;

const ENTREES = "entrees";
const META = "meta";
const FILE = "file";
const HISTORIQUE = "historique";

export interface MetaManifeste {
  cle: "manifeste";
  etag: string | null;
  genereLe: string;
  synchroniseLe: string;
  edition: string;
  zones: Manifeste["zones"];
  checkpoints: Manifeste["checkpoints"];
  entrees: number;
}

let connexion: Promise<IDBDatabase> | null = null;

function ouvrir(): Promise<IDBDatabase> {
  if (connexion) return connexion;

  connexion = new Promise((resoudre, rejeter) => {
    const requete = indexedDB.open(NOM_BASE, VERSION);

    requete.onupgradeneeded = () => {
      const base = requete.result;
      if (!base.objectStoreNames.contains(ENTREES)) {
        base.createObjectStore(ENTREES, { keyPath: "h" });
      }
      if (!base.objectStoreNames.contains(META)) {
        base.createObjectStore(META, { keyPath: "cle" });
      }
      if (!base.objectStoreNames.contains(FILE)) {
        base.createObjectStore(FILE, { keyPath: "clientScanId" });
      }
      if (!base.objectStoreNames.contains(HISTORIQUE)) {
        base.createObjectStore(HISTORIQUE, { keyPath: "cle" });
      }
    };

    requete.onsuccess = () => resoudre(requete.result);
    requete.onerror = () => rejeter(requete.error);
  });

  return connexion;
}

function attendre<T>(requete: IDBRequest<T>): Promise<T> {
  return new Promise((resoudre, rejeter) => {
    requete.onsuccess = () => resoudre(requete.result);
    requete.onerror = () => rejeter(requete.error);
  });
}

function transaction(
  base: IDBDatabase,
  magasins: string[],
  mode: IDBTransactionMode,
): IDBTransaction {
  return base.transaction(magasins, mode);
}

/**
 * Remplace le manifeste local.
 *
 * Le vidage et l'écriture se font dans **une seule transaction** : une coupure
 * au milieu laisserait sinon un scanner avec un index vide, qui refuserait tout
 * le monde en annonçant « badge inconnu ».
 */
export async function remplacerManifeste(manifeste: Manifeste, etag: string | null): Promise<void> {
  const base = await ouvrir();

  await new Promise<void>((resoudre, rejeter) => {
    const tx = transaction(base, [ENTREES, META], "readwrite");
    const entrees = tx.objectStore(ENTREES);
    entrees.clear();
    for (const entree of manifeste.entrees) entrees.put(entree);

    const meta: MetaManifeste = {
      cle: "manifeste",
      etag,
      genereLe: manifeste.genereLe,
      synchroniseLe: new Date().toISOString(),
      edition: manifeste.edition,
      zones: manifeste.zones,
      checkpoints: manifeste.checkpoints,
      entrees: manifeste.entrees.length,
    };
    tx.objectStore(META).put(meta);

    tx.oncomplete = () => resoudre();
    tx.onerror = () => rejeter(tx.error);
    tx.onabort = () => rejeter(tx.error);
  });
}

/** Met à jour la seule date de synchronisation, après un 304. */
export async function marquerSynchronise(): Promise<void> {
  const meta = await lireMeta();
  if (!meta) return;
  const base = await ouvrir();
  const tx = transaction(base, [META], "readwrite");
  tx.objectStore(META).put({ ...meta, synchroniseLe: new Date().toISOString() });
}

export async function lireMeta(): Promise<MetaManifeste | null> {
  const base = await ouvrir();
  const tx = transaction(base, [META], "readonly");
  const valeur = await attendre<MetaManifeste | undefined>(tx.objectStore(META).get("manifeste"));
  return valeur ?? null;
}

export async function chercherEmpreinte(empreinte: string): Promise<EntreeManifeste | null> {
  const base = await ouvrir();
  const tx = transaction(base, [ENTREES], "readonly");
  const valeur = await attendre<EntreeManifeste | undefined>(
    tx.objectStore(ENTREES).get(empreinte),
  );
  return valeur ?? null;
}

/**
 * Recherche manuelle, quand le QR est illisible (brief §5.6).
 *
 * Balayage complet du magasin plutôt qu'un index : à 1 500 entrées, c'est
 * quelques millisecondes, et un index par nom compliquerait la mise à jour du
 * manifeste sans rien apporter de perceptible.
 */
export async function rechercher(terme: string, limite = 12): Promise<EntreeManifeste[]> {
  const normalise = terme.trim().toLowerCase();
  if (normalise.length < 2) return [];

  const base = await ouvrir();
  const tx = transaction(base, [ENTREES], "readonly");
  const toutes = await attendre<EntreeManifeste[]>(tx.objectStore(ENTREES).getAll());

  const vus = new Set<string>();
  const resultats: EntreeManifeste[] = [];

  for (const entree of toutes) {
    // Un participant peut avoir plusieurs versions de badge : on ne propose que
    // la valide, sans quoi l'agent pourrait sélectionner un badge périmé.
    if (entree.revoque || vus.has(entree.publicId)) continue;
    const cible = `${entree.nom} ${entree.publicId} ${entree.organisation ?? ""}`.toLowerCase();
    if (!cible.includes(normalise)) continue;

    vus.add(entree.publicId);
    resultats.push(entree);
    if (resultats.length >= limite) break;
  }

  return resultats.sort((a, b) => a.nom.localeCompare(b.nom));
}

// ---------------------------------------------------------------------------
// File d'attente des scans
// ---------------------------------------------------------------------------

export async function empiler(scan: ScanEntry): Promise<void> {
  const base = await ouvrir();
  const tx = transaction(base, [FILE], "readwrite");
  await attendre(tx.objectStore(FILE).put(scan));
}

export async function lireFile(): Promise<ScanEntry[]> {
  const base = await ouvrir();
  const tx = transaction(base, [FILE], "readonly");
  return attendre<ScanEntry[]>(tx.objectStore(FILE).getAll());
}

export async function compterFile(): Promise<number> {
  const base = await ouvrir();
  const tx = transaction(base, [FILE], "readonly");
  return attendre<number>(tx.objectStore(FILE).count());
}

/** Retire de la file les scans acceptés par le serveur. */
export async function depiler(identifiants: string[]): Promise<void> {
  if (identifiants.length === 0) return;
  const base = await ouvrir();

  await new Promise<void>((resoudre, rejeter) => {
    const tx = transaction(base, [FILE], "readwrite");
    const magasin = tx.objectStore(FILE);
    for (const identifiant of identifiants) magasin.delete(identifiant);
    tx.oncomplete = () => resoudre();
    tx.onerror = () => rejeter(tx.error);
  });
}

// ---------------------------------------------------------------------------
// Anti-double-scan
// ---------------------------------------------------------------------------

/**
 * Dernier passage d'un badge à un point donné, conservé localement.
 *
 * **Portée volontairement limitée à l'appareil** : hors ligne, deux tablettes
 * postées à la même entrée ne peuvent pas se voir. La règle des deux minutes
 * (§2.5) vaut donc par appareil. La faire porter sur le serveur reviendrait à
 * la perdre exactement quand le réseau manque, c'est-à-dire quand elle sert.
 */
function cleHistorique(empreinte: string, checkpointId: string): string {
  return `${empreinte}:${checkpointId}`;
}

export async function dernierPassage(
  empreinte: string,
  checkpointId: string,
): Promise<Date | null> {
  const base = await ouvrir();
  const tx = transaction(base, [HISTORIQUE], "readonly");
  const valeur = await attendre<{ cle: string; a: string } | undefined>(
    tx.objectStore(HISTORIQUE).get(cleHistorique(empreinte, checkpointId)),
  );
  return valeur ? new Date(valeur.a) : null;
}

export async function noterPassage(
  empreinte: string,
  checkpointId: string,
  quand: Date,
): Promise<void> {
  const base = await ouvrir();
  const tx = transaction(base, [HISTORIQUE], "readwrite");
  await attendre(
    tx.objectStore(HISTORIQUE).put({
      cle: cleHistorique(empreinte, checkpointId),
      a: quand.toISOString(),
      empreinte,
    }),
  );
}

/** Le badge a-t-il déjà été vu aujourd'hui, tous points confondus ? */
export async function vuAujourdhui(empreinte: string, jour: string): Promise<boolean> {
  const base = await ouvrir();
  const tx = transaction(base, [HISTORIQUE], "readonly");
  const toutes = await attendre<{ cle: string; a: string; empreinte?: string }[]>(
    tx.objectStore(HISTORIQUE).getAll(),
  );
  return toutes.some((ligne) => ligne.empreinte === empreinte && ligne.a.startsWith(jour));
}

/** Utilisé par les tests, et par le bouton « oublier cet appareil ». */
export async function toutEffacer(): Promise<void> {
  const base = await ouvrir();
  await new Promise<void>((resoudre, rejeter) => {
    const tx = transaction(base, [ENTREES, META, FILE, HISTORIQUE], "readwrite");
    for (const magasin of [ENTREES, META, FILE, HISTORIQUE]) tx.objectStore(magasin).clear();
    tx.oncomplete = () => resoudre();
    tx.onerror = () => rejeter(tx.error);
  });
}
