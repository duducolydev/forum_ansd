import { Bed, Building2, BusFront, Mail, PlaneLanding, StampIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Les six rubriques des « Infos pratiques » (§29) — source unique.
 *
 * La page de la rubrique et sa page de détail lisent la même liste : c'est ce
 * qui garantit qu'un encart cliquable mène toujours quelque part, et qu'une
 * rubrique ajoutée apparaît des deux côtés du même geste. Le segment d'URL est
 * figé et sans accent : il entre dans des adresses partagées par courriel, et
 * un « hébergement » encodé en pourcentages est illisible dans un message.
 */
export interface Rubrique {
  /** Segment d'URL : /infos-pratiques/<segment>. */
  segment: string;
  /** Clé de l'encart court, page « Infos pratiques ». */
  cle: string;
  /** Clé du texte long, page de détail. Absente pour les rubriques listées. */
  cleDetail?: string;
  labelFr: string;
  labelEn: string;
  icone: LucideIcon;
  ton: string;
  /** Contenu structuré de la page de détail, s'il y en a un. */
  liste?: "hotels" | "contacts";
}

export const RUBRIQUES: readonly Rubrique[] = [
  {
    segment: "lieu",
    cle: "practical.venue",
    cleDetail: "practical.venue.detail",
    labelFr: "Lieu",
    labelEn: "Venue",
    icone: Building2,
    ton: "bg-blue-soft text-blue-text",
  },
  {
    segment: "arrivee",
    cle: "practical.arrival",
    cleDetail: "practical.arrival.detail",
    labelFr: "Arrivée",
    labelEn: "Arrival",
    icone: PlaneLanding,
    ton: "bg-accent-soft text-accent-text",
  },
  {
    segment: "hebergement",
    cle: "practical.accommodation",
    labelFr: "Hébergement",
    labelEn: "Accommodation",
    icone: Bed,
    ton: "bg-gold-soft text-gold-text",
    liste: "hotels",
  },
  {
    segment: "visas",
    cle: "practical.visa",
    cleDetail: "practical.visa.detail",
    labelFr: "Visas",
    labelEn: "Visas",
    icone: StampIcon,
    ton: "bg-warn-soft text-warn-text",
  },
  {
    segment: "transports",
    cle: "practical.transport",
    cleDetail: "practical.transport.detail",
    labelFr: "Transports",
    labelEn: "Transport",
    icone: BusFront,
    ton: "bg-blue-soft text-blue-text",
  },
  {
    segment: "contacts",
    cle: "practical.contacts",
    labelFr: "Contacts",
    labelEn: "Contacts",
    icone: Mail,
    ton: "bg-accent-soft text-accent-text",
    liste: "contacts",
  },
] as const;

export function rubriqueParSegment(segment: string): Rubrique | undefined {
  return RUBRIQUES.find((r) => r.segment === segment);
}

export function libelle(rubrique: Rubrique, locale: "fr" | "en"): string {
  return locale === "en" ? rubrique.labelEn : rubrique.labelFr;
}
