"use client";

import { useEffect, useState } from "react";

function computeParts(target: Date) {
  const diff = Math.max(0, target.getTime() - Date.now());
  return {
    days: Math.floor(diff / 86_400_000),
    hours: String(Math.floor((diff / 3_600_000) % 24)).padStart(2, "0"),
    minutes: String(Math.floor((diff / 60_000) % 60)).padStart(2, "0"),
    seconds: String(Math.floor((diff / 1_000) % 60)).padStart(2, "0"),
  };
}

/**
 * Compte à rebours côté client (brief §5.1) — heure de Dakar = UTC (pas de fuseau à convertir).
 *
 * - `panneau` : quatre grandes cases, pour un panneau sombre.
 * - `mini` : une vignette compacte, posée en haut à droite du bandeau d'accueil
 *   (demande du commanditaire, 28 septembre 2026) — le grand logo a pris la
 *   place du panneau.
 *
 * Chaque chiffre qui change rejoue une courte animation (`.chiffre-tic`) : la
 * clé React change avec la valeur, ce qui remonte l'élément.
 */
export function Countdown({
  targetIso,
  variante = "panneau",
  en = false,
}: {
  targetIso: string;
  variante?: "panneau" | "mini";
  en?: boolean;
}) {
  const [parts, setParts] = useState(() => computeParts(new Date(targetIso)));

  useEffect(() => {
    const target = new Date(targetIso);
    // Recalcul immédiat au montage : sans lui, la valeur rendue par le serveur
    // resterait affichée jusqu'au premier battement de l'intervalle.
    setParts(computeParts(target));
    const interval = setInterval(() => setParts(computeParts(target)), 1000);
    return () => clearInterval(interval);
  }, [targetIso]);

  const libelles = en
    ? { days: "days", hours: "hrs", minutes: "min", seconds: "sec" }
    : { days: "jours", hours: "h", minutes: "min", seconds: "s" };

  if (variante === "mini") {
    return (
      <div className="flex items-stretch gap-1.5">
        <Mini value={parts.days} label={libelles.days} />
        <Mini value={parts.hours} label={libelles.hours} />
        <Mini value={parts.minutes} label={libelles.minutes} />
        <Mini value={parts.seconds} label={libelles.seconds} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-2">
      <Cell value={parts.days} label="jours" />
      <Cell value={parts.hours} label="heures" />
      <Cell value={parts.minutes} label="minutes" />
      <Cell value={parts.seconds} label="secondes" />
    </div>
  );
}

function Mini({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="min-w-[2.9rem] rounded-lg border border-white/10 bg-white/8 px-1.5 py-1.5 text-center">
      {/* `suppressHydrationWarning` : voir `Cell`. */}
      <b
        key={value}
        suppressHydrationWarning
        className="chiffre-tic num font-display block text-lg leading-none font-bold"
      >
        {value}
      </b>
      <span className="text-dark-panel-muted text-[0.62rem] leading-none">{label}</span>
    </div>
  );
}

function Cell({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/6 px-1.5 py-3.5 text-center">
      {/*
        `suppressHydrationWarning` : la valeur est calculée à partir de l'heure
        courante, donc au rendu serveur puis à nouveau au rendu client, à
        quelques centaines de millisecondes d'écart — les secondes diffèrent
        forcément. React signalait l'écart comme une erreur d'hydratation (#418)
        sur chaque chargement de l'accueil.

        C'est ici l'usage prévu de cet attribut : l'écart est réel, attendu et
        sans conséquence, et l'effet corrige la valeur dès la seconde suivante.
        L'alternative — n'afficher qu'un gabarit vide jusqu'au montage —
        supprimerait l'écart, au prix d'un compte à rebours visiblement vide au
        premier rendu.
      */}
      <b
        suppressHydrationWarning
        className="num font-display block text-[2rem] leading-none font-bold"
      >
        {value}
      </b>
      <span className="text-dark-panel-muted text-[0.7rem]">{label}</span>
    </div>
  );
}
