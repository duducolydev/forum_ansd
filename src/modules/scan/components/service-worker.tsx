"use client";

import { useEffect } from "react";

/**
 * Enregistrement du service worker du scanner.
 *
 * La portée est forcée à `/scan` : le script est servi depuis la racine, donc
 * son périmètre par défaut serait le site entier — un cache de coquille
 * s'appliquerait alors au BackOffice et aux pages publiques, ce qu'on ne veut
 * pas. Un script à la racine peut réduire sa portée sans en-tête particulier.
 *
 * L'échec d'enregistrement est ignoré : sans service worker le scanner reste
 * pleinement fonctionnel tant que la page n'est pas rechargée hors connexion.
 * Ce n'est pas une raison d'empêcher un agent de travailler.
 */
export function EnregistrementServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/scan-sw.js", { scope: "/scan" }).catch(() => undefined);
  }, []);

  return null;
}
