/*
 * Service worker du scanner (brief §5.6).
 *
 * Objectif unique : que `/scan` s'ouvre encore quand le réseau a disparu. Le
 * manifeste des badges, lui, vit dans IndexedDB — ce fichier ne s'occupe que de
 * la coquille de l'application.
 *
 * Stratégie volontairement simple, « réseau d'abord puis cache » pour la
 * navigation et le manifeste d'installation, « cache d'abord » pour les
 * ressources statiques de Next. Un pré-chargement à l'installation supposerait
 * de connaître le nom des fragments JavaScript produits par la compilation, qui
 * change à chaque déploiement ; ici, la première visite en ligne suffit à
 * remplir le cache.
 *
 * Le manifeste d'installation est passé en « réseau d'abord » (PLAN.md §16.7) :
 * servi depuis le cache, il aurait privé des nouvelles icônes tout appareil
 * ayant déjà ouvert le scanner. Les ressources de `/_next/` peuvent rester en
 * « cache d'abord » parce que leur nom change avec leur contenu ; celui du
 * manifeste, non.
 *
 * Ce qui n'est **jamais** mis en cache : les appels d'API. Un manifeste ou une
 * synchronisation servis depuis le cache donneraient à l'agent une réponse
 * périmée en la faisant passer pour fraîche.
 */
const CACHE = "forum-scan-v2";

self.addEventListener("install", (evenement) => {
  evenement.waitUntil(caches.open(CACHE).then((cache) => cache.add("/scan")));
  self.skipWaiting();
});

self.addEventListener("activate", (evenement) => {
  evenement.waitUntil(
    caches
      .keys()
      .then((noms) =>
        Promise.all(noms.filter((nom) => nom !== CACHE).map((nom) => caches.delete(nom))),
      )
      .then(() => self.clients.claim()),
  );
});

/** Réseau d'abord ; la copie en cache ne sert que si le réseau manque. */
function reseauPuisCache(requete, cle) {
  return fetch(requete)
    .then((reponse) => {
      if (reponse.ok) {
        const copie = reponse.clone();
        void caches.open(CACHE).then((cache) => cache.put(cle, copie));
      }
      return reponse;
    })
    .catch(() => caches.match(cle).then((cache) => cache ?? Response.error()));
}

self.addEventListener("fetch", (evenement) => {
  const requete = evenement.request;
  if (requete.method !== "GET") return;

  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (requete.mode === "navigate") {
    evenement.respondWith(reseauPuisCache(requete, "/scan"));
    return;
  }

  if (url.pathname === "/scan.webmanifest") {
    evenement.respondWith(reseauPuisCache(requete, "/scan.webmanifest"));
    return;
  }

  if (url.pathname.startsWith("/_next/")) {
    evenement.respondWith(
      caches.match(requete).then(
        (cache) =>
          cache ??
          fetch(requete).then((reponse) => {
            const copie = reponse.clone();
            void caches.open(CACHE).then((store) => store.put(requete, copie));
            return reponse;
          }),
      ),
    );
  }
});
