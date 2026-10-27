"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";

/** Images demandées en même temps. */
const EN_PARALLELE = 4;
/** Essais d'une image avant de la déclarer en échec. */
const ESSAIS_MAX = 3;

/** `pause` : l'image a échoué, un nouvel essai est programmé. */
type Statut = "attente" | "chargement" | "chargee" | "pause" | "echec";

interface Etat {
  statut: Statut;
  essai: number;
}

/**
 * Images de la planche d'impression, chargées quatre à la fois et retentées en
 * cas d'échec (27 octobre 2026).
 *
 * Une planche de cent badges demandait jusqu'ici ses cent images d'un coup —
 * une centaine de mégaoctets depuis la maquette 2026, dont chaque PNG pèse
 * environ 1 Mo. Que la connexion soit coupée en route, et des badges restaient
 * blancs, sans qu'on le voie avant d'avoir imprimé. Le compteur dit désormais
 * ce qui est chargé, et ce qui ne l'est pas.
 */
export function PlancheImages({ badges }: { badges: { badgeId: string; nom: string }[] }) {
  const [etats, setEtats] = useState<Etat[]>(() =>
    badges.map(() => ({ statut: "attente", essai: 0 })),
  );

  const changer = useCallback((rang: number, etat: Partial<Etat>) => {
    setEtats((avant) => avant.map((e, i) => (i === rang ? { ...e, ...etat } : e)));
  }, []);

  // Démarre les suivantes tant qu'il reste de la place.
  useEffect(() => {
    const places = EN_PARALLELE - etats.filter((e) => e.statut === "chargement").length;
    const suivantes = etats
      .map((e, rang) => (e.statut === "attente" ? rang : -1))
      .filter((rang) => rang >= 0)
      .slice(0, Math.max(0, places));
    if (suivantes.length === 0) return;
    setEtats((avant) =>
      avant.map((e, i) => (suivantes.includes(i) ? { ...e, statut: "chargement" } : e)),
    );
  }, [etats]);

  const echouer = (rang: number) => {
    const essai = etats[rang]!.essai + 1;
    if (essai >= ESSAIS_MAX) {
      changer(rang, { statut: "echec", essai });
      return;
    }
    // Pause croissante avant le nouvel essai : un serveur saturé a besoin de souffler.
    changer(rang, { statut: "pause", essai });
    window.setTimeout(() => changer(rang, { statut: "attente" }), 1500 * essai);
  };

  const chargees = etats.filter((e) => e.statut === "chargee").length;
  const enEchec = etats.filter((e) => e.statut === "echec").length;
  const termine = chargees === badges.length;

  return (
    <>
      <div className="consignes border-border bg-surface mb-6 flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm">
        <p role="status" className={termine ? "text-accent-text font-semibold" : "text-text-2"}>
          {termine
            ? `Les ${badges.length} badge(s) sont chargés : la planche est prête à imprimer.`
            : `${chargees} / ${badges.length} badge(s) chargés — attendez la fin avant d'imprimer.`}
        </p>
        {enEchec > 0 && (
          <>
            <p className="text-danger-text font-semibold">
              {enEchec} badge(s) n&apos;ont pas pu être chargés.
            </p>
            <Bouton
              type="button"
              taille="petit"
              icone={RefreshCw}
              onClick={() =>
                setEtats((avant) =>
                  avant.map((e) => (e.statut === "echec" ? { ...e, statut: "attente" } : e)),
                )
              }
            >
              Réessayer
            </Bouton>
          </>
        )}
      </div>

      {badges.map((badge, rang) => {
        const { statut, essai } = etats[rang]!;
        return (
          <div key={badge.badgeId} className="badge">
            {statut === "chargement" || statut === "chargee" ? (
              /* eslint-disable-next-line @next/next/no-img-element -- image privée servie par une route authentifiée, hors optimiseur */
              <img
                // Le numéro d'essai change l'adresse : le navigateur redemande vraiment l'image.
                src={`/api/v1/badges/${badge.badgeId}/png${essai > 0 ? `?essai=${essai}` : ""}`}
                alt={`Badge de ${badge.nom}`}
                onLoad={() => changer(rang, { statut: "chargee" })}
                onError={() => echouer(rang)}
              />
            ) : (
              <p className="attente">
                {statut === "echec"
                  ? `Badge de ${badge.nom} : non chargé.`
                  : `Badge de ${badge.nom} : chargement…`}
              </p>
            )}
          </div>
        );
      })}
    </>
  );
}
