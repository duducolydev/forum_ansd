import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import {
  CalendarDays,
  FileText,
  MapPin,
  Mic,
  Newspaper,
  ShieldCheck,
  Ticket,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

/**
 * Boutons du site public (§10).
 *
 * Distincts de ceux du BackOffice : plus grands, plus arrondis, avec un léger
 * soulèvement au survol. Un visiteur passe quelques minutes sur le site, un
 * agent passe sa journée dans le BackOffice — les deux ne demandent pas la même
 * densité.
 *
 * L'existence de ce fichier tient à une leçon déjà payée : les classes du
 * bouton du BackOffice avaient été recopiées dans une trentaine d'écrans et
 * avaient divergé. Ici, elles sont écrites une fois.
 */

export type TonSite = "principal" | "secondaire" | "discret";
export type TailleSite = "normal" | "compact";

const TONS: Record<TonSite, string> = {
  principal:
    "bg-primary text-primary-text hover:bg-primary-hover shadow-sm hover:shadow-lg hover:-translate-y-0.5",
  secondaire:
    "border-border bg-surface text-heading hover:border-link border hover:-translate-y-0.5 hover:shadow-md",
  discret: "text-link hover:bg-blue-soft border border-transparent",
};

const TAILLES: Record<TailleSite, string> = {
  normal: "rounded-xl px-5 py-3 gap-2",
  compact: "rounded-lg px-3.5 py-2 text-sm gap-2",
};

const BASE =
  "transition-tout inline-flex items-center justify-center font-semibold no-underline disabled:pointer-events-none disabled:opacity-60";

export function classesBoutonSite(ton: TonSite = "secondaire", taille: TailleSite = "normal") {
  return `${BASE} ${TONS[ton]} ${TAILLES[taille]}`;
}

/**
 * Icône déduite de la destination.
 *
 * Aucun réglage ne demande d'icône : en réclamer une à chaque bouton ajouterait
 * un champ que personne ne saurait remplir. Les destinations récurrentes du
 * site en reçoivent une, les autres n'en ont pas — ce qui vaut mieux qu'une
 * icône générique qui n'apprend rien.
 */
const ICONES_LIEN: { motif: RegExp; icone: LucideIcon }[] = [
  { motif: /^\/inscription/, icone: UserPlus },
  { motif: /^\/programme/, icone: CalendarDays },
  { motif: /^\/mon-espace/, icone: Ticket },
  { motif: /^\/intervenants/, icone: Mic },
  { motif: /^\/actualites/, icone: Newspaper },
  { motif: /^\/infos-pratiques/, icone: MapPin },
  { motif: /^\/verifier/, icone: ShieldCheck },
  { motif: /^\/contributions/, icone: FileText },
];

export function iconeDeLien(href: string): LucideIcon | null {
  return ICONES_LIEN.find((entree) => entree.motif.test(href))?.icone ?? null;
}

interface CommunSite {
  icone?: LucideIcon;
  /** Icône placée après le texte : « suite », « lire », « voir tout ». */
  iconeApres?: LucideIcon;
  ton?: TonSite;
  taille?: TailleSite;
  className?: string;
  children?: ReactNode;
}

function contenu({ icone: Icone, iconeApres: Apres, taille, children }: CommunSite) {
  const dimension = taille === "compact" ? 15 : 17;
  return (
    <>
      {Icone && <Icone aria-hidden size={dimension} strokeWidth={2.2} />}
      {children}
      {Apres && <Apres aria-hidden size={dimension} strokeWidth={2.2} />}
    </>
  );
}

export function LienSite({
  icone,
  iconeApres,
  ton,
  taille,
  className = "",
  children,
  ...reste
}: CommunSite & ComponentProps<typeof Link>) {
  return (
    <Link className={`${classesBoutonSite(ton, taille)} ${className}`} {...reste}>
      {contenu({ icone, iconeApres, taille, children })}
    </Link>
  );
}

/**
 * Lien externe ou route hors Next (téléchargements, API).
 *
 * `noopener` est posé d'office sur les cibles en onglet neuf : la page ouverte
 * ne doit pas pouvoir manipuler celle du Forum via `window.opener`.
 */
export function LienSiteExterne({
  icone,
  iconeApres,
  ton,
  taille,
  className = "",
  children,
  target,
  rel,
  ...reste
}: CommunSite & ComponentProps<"a">) {
  return (
    <a
      className={`${classesBoutonSite(ton, taille)} ${className}`}
      target={target}
      rel={target === "_blank" ? (rel ?? "noopener noreferrer") : rel}
      {...reste}
    >
      {contenu({ icone, iconeApres, taille, children })}
    </a>
  );
}

export function BoutonSite({
  icone,
  iconeApres,
  ton,
  taille,
  className = "",
  children,
  ...reste
}: CommunSite & ComponentProps<"button">) {
  return (
    <button className={`${classesBoutonSite(ton, taille)} ${className}`} {...reste}>
      {contenu({ icone, iconeApres, taille, children })}
    </button>
  );
}
