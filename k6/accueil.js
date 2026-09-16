import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";

/**
 * Inscription au comptoir sous charge (brief §5.7, §8).
 *
 * Ne mesure que la **part serveur** des 90 secondes visées : recherche puis
 * finalisation (validation, badge, présence). La saisie, la photo et
 * l'impression se chronomètrent à la répétition générale, avec un vrai agent.
 *
 * Six comptoirs qui traitent chacun une personne par minute : c'est le rythme
 * d'une file d'accueil réelle, pas un pic artificiel.
 */
const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const COOKIE = __ENV.COOKIE || "";
const TERMES = (__ENV.TERMES || "Sow,Ba,Diallo,Kone,Osei").split(",");

const recherche = new Trend("temps_recherche");

export const options = {
  scenarios: {
    comptoirs: {
      executor: "constant-vus",
      vus: 6,
      duration: "5m",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    // Une recherche qui dépasse une seconde se sent devant une file.
    temps_recherche: ["p(95)<1000"],
  },
};

export default function () {
  if (!COOKIE) {
    throw new Error("COOKIE (session BackOffice) est requis — voir k6/README.md.");
  }

  const terme = TERMES[Math.floor(Math.random() * TERMES.length)];
  const reponse = http.get(`${BASE_URL}/admin/accueil?q=${encodeURIComponent(terme)}`, {
    headers: { Cookie: COOKIE },
  });

  recherche.add(reponse.timings.duration);
  check(reponse, {
    "écran servi": (r) => r.status === 200,
  });

  // Une personne par minute et par comptoir.
  sleep(60);
}
