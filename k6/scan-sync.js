import http from "k6/http";
import { check } from "k6";
import { Counter } from "k6/metrics";
import { uuidv4 } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";

/**
 * Synchronisation des scans sous charge (brief §8).
 *
 * Cible : 2 scans par seconde en pointe, répartis sur 6 points de contrôle. Le
 * scanner envoie par lots ; on reproduit ce profil plutôt qu'une requête par
 * scan, puisque c'est ainsi que la charge arrive réellement.
 *
 * Prérequis : `COOKIE` porte une session d'agent (`scan.use`), `CHECKPOINTS`
 * liste des identifiants de points de contrôle séparés par des virgules, et
 * `HASHES` des empreintes de badges valides.
 */
const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const COOKIE = __ENV.COOKIE || "";
const CHECKPOINTS = (__ENV.CHECKPOINTS || "").split(",").filter(Boolean);
const HASHES = (__ENV.HASHES || "").split(",").filter(Boolean);

const envoyes = new Counter("scans_envoyes");
const enregistres = new Counter("scans_enregistres");

export const options = {
  scenarios: {
    pointe: {
      executor: "constant-arrival-rate",
      // Un lot de 5 scans toutes les 2,5 s ≈ 2 scans/s.
      rate: 24,
      timeUnit: "1m",
      duration: "5m",
      preAllocatedVUs: 12,
      maxVUs: 30,
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    // Un agent attend devant une file : la synchronisation doit rester discrète.
    http_req_duration: ["p(95)<1000"],
  },
};

export default function () {
  if (!COOKIE || CHECKPOINTS.length === 0 || HASHES.length === 0) {
    throw new Error("COOKIE, CHECKPOINTS et HASHES sont requis — voir k6/README.md.");
  }

  const checkpointId = CHECKPOINTS[Math.floor(Math.random() * CHECKPOINTS.length)];
  const scans = Array.from({ length: 5 }, () => ({
    clientScanId: uuidv4(),
    checkpointId,
    tokenHash: HASHES[Math.floor(Math.random() * HASHES.length)],
    scannedAt: new Date().toISOString(),
    direction: "IN",
    result: "OK",
  }));

  const reponse = http.post(`${BASE_URL}/api/v1/scan/sync`, JSON.stringify({ scans }), {
    headers: { "Content-Type": "application/json", Cookie: COOKIE },
  });

  envoyes.add(scans.length);
  if (reponse.status === 200) {
    enregistres.add(reponse.json().enregistres ?? 0);
  }

  check(reponse, {
    "lot accepté": (r) => r.status === 200,
    "réponse sous 1 s": (r) => r.timings.duration < 1000,
  });

  // Renvoi du même lot une fois sur dix : c'est ce que fait un scanner dont le
  // réseau retombe en plein envoi. Le serveur doit l'absorber sans doublon.
  if (Math.random() < 0.1) {
    const rejeu = http.post(`${BASE_URL}/api/v1/scan/sync`, JSON.stringify({ scans }), {
      headers: { "Content-Type": "application/json", Cookie: COOKIE },
    });
    check(rejeu, {
      "renvoi sans doublon": (r) => r.status === 200 && r.json().enregistres === 0,
    });
  }
}
