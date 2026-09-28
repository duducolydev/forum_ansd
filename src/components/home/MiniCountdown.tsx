"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Compte à rebours miniature « JOUR J − » (brief §4.1).
 *
 * - **Rendu serveur : `--`**. Les chiffres dépendent de l'heure ; ils sont
 *   calculés après le montage, ce qui supprime tout écart d'hydratation. La
 *   place est réservée (cases de largeur fixe) : rien ne bouge à l'arrivée.
 * - **Lecteurs d'écran** : un `aria-label` explicite, qui ne change qu'à la
 *   minute. Un `aria-live` à la seconde rendrait la page inécoutable.
 * - **Après l'échéance** : « Le Forum est en cours » jusqu'à la fin de
 *   l'édition, puis « Merci ! » (libellés à confirmer par le comité).
 *
 * @param cibleIso Ouverture : début de la première session publiée, sinon
 *   début de l'édition — jamais une date écrite en dur.
 */

interface Parties {
  jours: number;
  heures: number;
  minutes: number;
  secondes: number;
}

function parties(cible: number): Parties | null {
  const reste = Math.floor((cible - Date.now()) / 1000);
  if (reste <= 0) return null;
  return {
    jours: Math.floor(reste / 86400),
    heures: Math.floor((reste % 86400) / 3600),
    minutes: Math.floor((reste % 3600) / 60),
    secondes: reste % 60,
  };
}

type Etat = { phase: "attente" } | { phase: "avant"; p: Parties } | { phase: "pendant" | "apres" };

export function MiniCountdown({ cibleIso, finIso }: { cibleIso: string; finIso: string }) {
  const t = useTranslations("constellation.countdown");
  const [etat, setEtat] = useState<Etat>({ phase: "attente" });

  useEffect(() => {
    const cible = new Date(cibleIso).getTime();
    const fin = new Date(finIso).getTime();
    function battre() {
      const p = parties(cible);
      if (p) setEtat({ phase: "avant", p });
      else setEtat({ phase: Date.now() < fin ? "pendant" : "apres" });
    }
    battre();
    const minuterie = window.setInterval(battre, 1000);
    return () => window.clearInterval(minuterie);
  }, [cibleIso, finIso]);

  if (etat.phase === "pendant" || etat.phase === "apres") {
    return (
      <div className="mini-compte">
        <span className="mini-compte__libelle">
          <span aria-hidden className="point-direct" />
          {etat.phase === "pendant" ? t("live") : t("over")}
        </span>
      </div>
    );
  }

  const p = etat.phase === "avant" ? etat.p : null;
  const deux = (valeur: number | undefined) =>
    valeur === undefined ? "--" : String(valeur).padStart(2, "0");
  const unites: [string, string][] = [
    [deux(p?.jours), t("days")],
    [deux(p?.heures), t("hours")],
    [deux(p?.minutes), t("minutes")],
    [deux(p?.secondes), t("seconds")],
  ];

  return (
    <div
      role="timer"
      className="mini-compte"
      aria-label={
        p ? t("aria", { days: p.jours, hours: p.heures, minutes: p.minutes }) : t("label")
      }
    >
      <span aria-hidden className="mini-compte__libelle">
        <span className="point-direct" />
        <span className="mini-compte__texte">{t("label")}</span>
      </span>
      <span aria-hidden className="mini-compte__unites">
        {unites.map(([valeur, libelle], rang) => (
          <span key={libelle} className="contents">
            {rang > 0 && <span className="mini-compte__deux-points">:</span>}
            <span className="mini-compte__case">
              <span className="mini-compte__chiffre police-grotesk">
                {/* La clé change avec la valeur : le chiffre est remonté et
                    rejoue sa bascule depuis le haut. */}
                <span key={valeur} className={p ? "bascule" : undefined}>
                  {valeur}
                </span>
              </span>
              <small>{libelle}</small>
            </span>
          </span>
        ))}
      </span>
    </div>
  );
}
