"use client";

import { useEffect } from "react";

/**
 * Filet de sécurité des pages caméra (PLAN.md §16).
 *
 * La politique `Permissions-Policy` d'un document est fixée à son chargement.
 * Le menu du BackOffice mène aux pages caméra par un rechargement complet ; mais
 * d'autres chemins restent des navigations internes (redirection après
 * connexion, lien ajouté demain ailleurs, retour arrière). Sur ces chemins, la
 * page hérite de la politique du document de départ, et la caméra est refusée.
 *
 * Ce crochet le détecte au montage et recharge **une fois** : le rechargement
 * obtient les bons en-têtes. Au montage, rien n'est encore saisi, donc rien ne
 * se perd.
 */

const DELAI_ANTI_BOUCLE_MS = 15_000;

interface PolitiqueDocument {
  allowsFeature(nom: string): boolean;
}

/** `true`/`false` selon la politique du document ; `null` si le navigateur ne l'expose pas. */
export function documentAutoriseLaCamera(): boolean | null {
  const doc = document as Document & {
    permissionsPolicy?: PolitiqueDocument;
    featurePolicy?: PolitiqueDocument;
  };
  const politique = doc.permissionsPolicy ?? doc.featurePolicy;
  return politique ? politique.allowsFeature("camera") : null;
}

export function useDocumentAvecCamera(): void {
  useEffect(() => {
    // `null` : navigateur sans cette API (Safari, Firefox), qui n'applique pas
    // non plus l'en-tête à la caméra — rien à corriger.
    if (documentAutoriseLaCamera() !== false) return;

    const cle = `rechargement-camera:${window.location.pathname}`;
    try {
      const dernier = Number(window.sessionStorage.getItem(cle) ?? 0);
      // Déjà rechargé à l'instant : si la politique refuse encore, recharger de
      // nouveau ne changerait rien et tournerait en boucle.
      if (Date.now() - dernier < DELAI_ANTI_BOUCLE_MS) return;
      window.sessionStorage.setItem(cle, String(Date.now()));
    } catch {
      // Sans stockage, impossible de garantir l'absence de boucle : on s'abstient.
      return;
    }

    window.location.reload();
  }, []);
}
