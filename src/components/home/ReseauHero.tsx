"use client";

import dynamic from "next/dynamic";

/**
 * Chargement différé du réseau de données (brief §2.2) : pas de rendu serveur,
 * et le script du canvas ne pèse pas sur le premier affichage.
 */
const HeroNetwork = dynamic(() => import("./HeroNetwork"), { ssr: false });

export function ReseauHero({ leger = false }: { leger?: boolean }) {
  return <HeroNetwork leger={leger} />;
}
