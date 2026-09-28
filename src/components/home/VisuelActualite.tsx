"use client";

import dynamic from "next/dynamic";

/**
 * Visuel génératif d'une actualité sans couverture, chargé sans rendu serveur
 * (brief §2.2) : graine stable dérivée de l'identifiant de l'article.
 */
const NewsCanvas = dynamic(() => import("./NewsCanvas"), { ssr: false });

export function VisuelActualite({ id }: { id: string }) {
  return (
    <div aria-hidden className="relative h-[220px] overflow-hidden rounded-2xl bg-[var(--deep)]">
      <NewsCanvas id={id} />
    </div>
  );
}
