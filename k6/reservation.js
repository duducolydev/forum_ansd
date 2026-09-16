import http from "k6/http";
import { check } from "k6";
import { Counter } from "k6/metrics";

/**
 * Réservation de panels sous charge (brief §8).
 *
 * Cible : 300 réservations en 10 minutes à l'ouverture, soit 0,5 par seconde.
 * Le débit est modeste ; ce qu'on surveille n'est pas le plafond mais la
 * **justesse sous concurrence** — aucune place ne doit être vendue deux fois.
 *
 * Prérequis : `SESSION_ID` désigne une session ouverte à la réservation, et
 * `COOKIES` porte des sessions participant valides, une par ligne. Les obtenir
 * demande de vraies connexions par lien magique ; le script ne les fabrique pas,
 * pour ne pas avoir à embarquer le secret de signature dans un fichier de test.
 */
const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const SESSION_ID = __ENV.SESSION_ID;
const COOKIES = (__ENV.COOKIES || "").split(",").filter(Boolean);

const inscrits = new Counter("reservations_acceptees");
const attente = new Counter("reservations_en_attente");
const refus = new Counter("reservations_refusees");

export const options = {
  scenarios: {
    ouverture: {
      // Le profil réel : une ruée à l'ouverture, pas une charge constante.
      executor: "ramping-arrival-rate",
      startRate: 1,
      timeUnit: "1s",
      preAllocatedVUs: 20,
      maxVUs: 60,
      stages: [
        { target: 5, duration: "1m" },
        { target: 1, duration: "8m" },
        { target: 0, duration: "1m" },
      ],
    },
  },
  thresholds: {
    // Un refus métier (session complète) est une réponse normale, pas une
    // erreur : seuls les 5xx comptent comme échec.
    "http_req_failed{expected_response:true}": ["rate<0.01"],
    http_req_duration: ["p(95)<1500"],
  },
};

export default function () {
  if (!SESSION_ID || COOKIES.length === 0) {
    throw new Error("SESSION_ID et COOKIES sont requis — voir k6/README.md.");
  }

  const cookie = COOKIES[Math.floor(Math.random() * COOKIES.length)];
  const reponse = http.post(`${BASE_URL}/api/v1/sessions/${SESSION_ID}/register`, null, {
    headers: { Cookie: `forum-participant-session=${cookie}` },
  });

  if (reponse.status === 200) {
    const corps = reponse.json();
    if (corps.statut === "INSCRIT") inscrits.add(1);
    else attente.add(1);
  } else if (reponse.status === 409 || reponse.status === 403) {
    refus.add(1);
  }

  check(reponse, {
    "pas d'erreur serveur": (r) => r.status < 500,
    "réponse sous 2 s": (r) => r.timings.duration < 2000,
  });
}

/**
 * Le contrôle décisif se fait **après** la charge, en base :
 *
 *   SELECT COUNT(*) FROM SessionRegistration
 *   WHERE sessionId = ? AND status IN ('REGISTERED','ATTENDED');
 *
 * Ce nombre ne doit jamais dépasser la capacité de la session. C'est ce que le
 * `SELECT … FOR UPDATE` garantit, et ce qu'un test unitaire vérifie déjà à
 * 20 requêtes simultanées sur une place unique.
 */
export function handleSummary(data) {
  return {
    stdout: `
Réservations acceptées : ${data.metrics.reservations_acceptees?.values.count ?? 0}
Mises en liste d'attente : ${data.metrics.reservations_en_attente?.values.count ?? 0}
Refusées : ${data.metrics.reservations_refusees?.values.count ?? 0}

À vérifier en base : le nombre d'inscrits confirmés ne dépasse pas la capacité.
`,
  };
}
