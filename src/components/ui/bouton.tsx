import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/**
 * Bouton du BackOffice, avec son icône.
 *
 * Une seule définition pour toutes les variantes : les classes étaient jusqu'ici
 * recopiées à la main dans une trentaine de fichiers, et elles avaient déjà
 * commencé à diverger — arrondis, hauteurs et états de survol différents d'un
 * écran à l'autre.
 *
 * **Nom accessible.** Quand le bouton porte un texte, l'icône est décorative
 * (`aria-hidden`) et le texte suffit. Quand il n'en porte pas, `titre` devient
 * à la fois l'infobulle **et** l'`aria-label` : `title` seul ne nomme pas
 * fiablement un élément — sa restitution varie d'un lecteur d'écran à l'autre,
 * et il n'apparaît jamais au clavier sans survol. Les deux ensemble couvrent la
 * souris, le clavier et la synthèse vocale.
 */
export type TonBouton = "principal" | "secondaire" | "discret" | "danger";
export type TailleBouton = "normal" | "petit";

const TONS: Record<TonBouton, string> = {
  principal:
    "bg-primary text-primary-text hover:bg-primary-hover shadow-sm hover:shadow-md border border-transparent",
  secondaire: "border-border bg-surface text-heading hover:border-link hover:bg-bg-2 border",
  discret: "text-link hover:bg-bg-2 border border-transparent",
  danger: "text-danger-text hover:bg-danger-soft border border-transparent",
};

const TAILLES: Record<TailleBouton, string> = {
  normal: "px-4 py-2.5 text-sm gap-2",
  petit: "px-3 py-1.5 text-xs gap-1.5",
};

/** Boutons réduits à leur icône : carrés, pour rester une cible cliquable franche. */
const TAILLES_CARREES: Record<TailleBouton, string> = {
  normal: "h-10 w-10",
  petit: "h-8 w-8",
};

/*
 * `transition-tout` est défini dans `globals.css` et neutralisé sous
 * `prefers-reduced-motion` : l'animation de survol ne doit pas s'imposer à qui
 * demande moins de mouvement à son système.
 */
const BASE =
  "inline-flex items-center justify-center rounded-lg font-semibold transition-tout disabled:opacity-60 disabled:pointer-events-none";

export function classesBouton(
  ton: TonBouton = "secondaire",
  taille: TailleBouton = "normal",
  iconeSeule = false,
) {
  return `${BASE} ${TONS[ton]} ${iconeSeule ? TAILLES_CARREES[taille] : TAILLES[taille]}`;
}

interface Commun {
  icone?: LucideIcon;
  ton?: TonBouton;
  taille?: TailleBouton;
  /** Infobulle. Devient aussi le nom accessible quand le bouton n'a pas de texte. */
  titre?: string;
  children?: ReactNode;
  className?: string;
}

/** Attributs communs calculés une fois : mêmes règles pour les trois variantes. */
function habiller({
  ton = "secondaire",
  taille = "normal",
  titre,
  className = "",
  children,
}: Commun) {
  const iconeSeule = children === undefined || children === null || children === false;
  return {
    iconeSeule,
    tailleIcone: taille === "petit" ? 14 : 16,
    attributs: {
      className: `${classesBouton(ton, taille, iconeSeule)} ${className}`,
      title: titre,
      ...(iconeSeule && titre ? { "aria-label": titre } : {}),
    },
  };
}

export function Bouton({
  icone: Icone,
  ton,
  taille,
  titre,
  className,
  children,
  ...reste
}: Commun & Omit<ComponentProps<"button">, "title">) {
  const { tailleIcone, attributs } = habiller({ ton, taille, titre, className, children });
  return (
    <button {...attributs} {...reste}>
      {Icone && <Icone aria-hidden size={tailleIcone} strokeWidth={2.2} />}
      {children}
    </button>
  );
}

export function LienBouton({
  icone: Icone,
  ton,
  taille,
  titre,
  className,
  children,
  ...reste
}: Commun & Omit<ComponentProps<typeof Link>, "title">) {
  const { tailleIcone, attributs } = habiller({ ton, taille, titre, className, children });
  return (
    <Link {...attributs} {...reste}>
      {Icone && <Icone aria-hidden size={tailleIcone} strokeWidth={2.2} />}
      {children}
    </Link>
  );
}

/** Lien externe ou route hors Next (téléchargements, API) : `<a>` et non `<Link>`. */
export function LienExterne({
  icone: Icone,
  ton,
  taille,
  titre,
  className,
  children,
  ...reste
}: Commun & Omit<ComponentProps<"a">, "title">) {
  const { tailleIcone, attributs } = habiller({ ton, taille, titre, className, children });
  return (
    <a {...attributs} {...reste}>
      {Icone && <Icone aria-hidden size={tailleIcone} strokeWidth={2.2} />}
      {children}
    </a>
  );
}
