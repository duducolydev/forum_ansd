import type { LucideIcon } from "lucide-react";

/**
 * Tuile d'indicateur. Une valeur seule n'est pas un graphique : pas de barre à
 * une barre, pas de camembert à deux parts — le nombre *est* la visualisation.
 *
 * Le libellé porte la **définition** de l'indicateur (`hint`) plutôt que de la
 * laisser implicite : « inscrits » ou « internationaux » n'ont rien d'évident,
 * et un tableau de bord dont les définitions se devinent finit par être lu de
 * travers.
 *
 * Les tons reprennent les couples adouci/texte **déjà vérifiés en contraste**
 * (`src/app/palette.test.ts`) au lieu d'introduire de nouvelles teintes : la
 * couleur d'un indicateur ne vaut pas de rouvrir la question de l'accessibilité.
 * Elle ne porte d'ailleurs aucune information à elle seule — le libellé dit
 * tout, la couleur ne fait que regrouper.
 */
export type TonTuile = "bleu" | "vert" | "or" | "orange" | "rouge" | "neutre";

const TONS: Record<TonTuile, { pastille: string; accent: string }> = {
  bleu: { pastille: "bg-blue-soft text-blue-text", accent: "bg-blue-text" },
  vert: { pastille: "bg-accent-soft text-accent-text", accent: "bg-accent-text" },
  or: { pastille: "bg-gold-soft text-gold-text", accent: "bg-gold-text" },
  orange: { pastille: "bg-warn-soft text-warn-text", accent: "bg-warn-text" },
  rouge: { pastille: "bg-danger-soft text-danger-text", accent: "bg-danger-text" },
  neutre: { pastille: "bg-bg-3 text-text-2", accent: "bg-text-3" },
};

export function StatTile({
  label,
  value,
  hint,
  emphasis = false,
  icone: Icone,
  ton = "neutre",
  rang = 0,
}: {
  label: string;
  value: string | number;
  hint?: string;
  emphasis?: boolean;
  icone?: LucideIcon;
  ton?: TonTuile;
  /** Rang d'affichage : décale l'apparition pour donner un sens de lecture. */
  rang?: number;
}) {
  const tons = TONS[ton];

  return (
    <div
      className="border-border bg-surface carte-relief apparait relative flex flex-col gap-1 overflow-hidden rounded-xl border p-4"
      /* Le décalage est plafonné : au-delà de huit tuiles, l'attente devient
         perceptible et l'effet se retourne contre la lisibilité. */
      style={{ animationDelay: `${Math.min(rang, 8) * 45}ms` }}
    >
      <span aria-hidden className={`absolute inset-x-0 top-0 h-[3px] ${tons.accent} opacity-70`} />

      <div className="flex items-start justify-between gap-2">
        <span className="text-text-3 text-xs font-medium">{label}</span>
        {Icone && (
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tons.pastille}`}>
            <Icone aria-hidden size={16} strokeWidth={2.2} />
          </span>
        )}
      </div>

      <span className={`text-heading num font-semibold ${emphasis ? "text-4xl" : "text-2xl"}`}>
        {typeof value === "number" ? value.toLocaleString("fr-FR") : value}
      </span>
      {hint && <span className="text-text-3 text-xs">{hint}</span>}
    </div>
  );
}
