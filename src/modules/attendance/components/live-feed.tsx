"use client";

import { useEffect, useState } from "react";
import type { LigneFlux } from "../service";

const PERIODE_MS = 5000;

const COULEUR: Record<string, string> = {
  OK: "bg-accent-soft text-accent-text",
  ALREADY: "bg-warn-soft text-warn-text",
  DENIED_ZONE: "bg-danger-soft text-danger-text",
  DENIED_STATUS: "bg-danger-soft text-danger-text",
  REVOKED: "bg-danger-soft text-danger-text",
  UNKNOWN: "bg-danger-soft text-danger-text",
};

const LIBELLE: Record<string, string> = {
  OK: "Autorisé",
  ALREADY: "Déjà scanné",
  DENIED_ZONE: "Zone refusée",
  DENIED_STATUS: "Statut refusé",
  REVOKED: "Révoqué",
  UNKNOWN: "Inconnu",
};

const heure = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/**
 * Flux des derniers scans, rafraîchi toutes les cinq secondes.
 *
 * L'horodatage n'est formaté qu'après le montage : rendu côté serveur, il
 * dépendrait du fuseau du serveur et non de celui du navigateur, ce qui
 * produirait une discordance d'hydratation — le même défaut que le compte à
 * rebours de l'accueil avait révélé.
 */
export function LiveFeed({ initial }: { initial: LigneFlux[] }) {
  const [flux, setFlux] = useState(initial);
  const [erreur, setErreur] = useState(false);
  const [monte, setMonte] = useState(false);

  useEffect(() => setMonte(true), []);

  useEffect(() => {
    let vivant = true;

    async function lire() {
      try {
        const reponse = await fetch("/api/v1/presences/flux", { cache: "no-store" });
        if (!reponse.ok) throw new Error(String(reponse.status));
        const donnees = (await reponse.json()) as { flux: LigneFlux[] };
        if (!vivant) return;
        setFlux(donnees.flux.map((ligne) => ({ ...ligne, scanneA: new Date(ligne.scanneA) })));
        setErreur(false);
      } catch {
        if (vivant) setErreur(true);
      }
    }

    const timer = setInterval(() => void lire(), PERIODE_MS);
    return () => {
      vivant = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="border-border bg-surface rounded-xl border p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-heading text-sm font-semibold">Flux des scans</h3>
        <span className="text-text-3 text-xs">
          {erreur ? "Reconnexion…" : "Actualisé toutes les 5 s"}
        </span>
      </div>

      {flux.length === 0 ? (
        <p className="text-text-3 text-sm">Aucun scan enregistré pour le moment.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {flux.map((ligne) => (
            <li
              key={ligne.id}
              className="border-border flex flex-wrap items-center gap-x-3 gap-y-1 border-b pb-2 text-sm last:border-0"
            >
              <span className="text-text-3 font-mono text-xs" suppressHydrationWarning>
                {monte ? heure.format(new Date(ligne.scanneA)) : "—"}
              </span>
              <span className="text-heading font-medium">{ligne.nom ?? "Badge inconnu"}</span>
              {ligne.categorie && <span className="text-text-3 text-xs">{ligne.categorie}</span>}
              <span className="text-text-3 text-xs">
                {ligne.point} · {ligne.zone}
              </span>
              <span
                className={`ml-auto rounded-md px-2 py-0.5 text-xs font-semibold ${
                  COULEUR[ligne.resultat] ?? "bg-blue-soft text-blue-text"
                }`}
              >
                {LIBELLE[ligne.resultat] ?? ligne.resultat}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
