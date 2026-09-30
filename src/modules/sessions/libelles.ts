import { selon } from "@/lib/langue";
import type { SESSION_TYPES } from "./schema";

/**
 * Libellés publics du programme, dans les trois langues du site (30 septembre
 * 2026). Module sans dépendance serveur : il sert aux pages comme aux
 * composants clients.
 *
 * `TYPE_LABELS` et `ETAT_LABELS` restent en français pour le BackOffice.
 */

type TypeSession = (typeof SESSION_TYPES)[number];
type EtatSession = "SANS_RESERVATION" | "OUVERTE" | "LISTE_ATTENTE" | "COMPLETE" | "CLOTUREE";
type Trois = { fr: string; en: string; pt: string };

const TYPES: Record<TypeSession, Trois> = {
  OPENING: { fr: "Ouverture", en: "Opening", pt: "Abertura" },
  PLENARY: { fr: "Plénière", en: "Plenary", pt: "Plenária" },
  PANEL: { fr: "Panel", en: "Panel", pt: "Painel" },
  INAUGURAL: { fr: "Conférence inaugurale", en: "Inaugural lecture", pt: "Conferência inaugural" },
  AWARDS: { fr: "Remise de prix", en: "Awards ceremony", pt: "Entrega de prémios" },
  BREAK: { fr: "Pause", en: "Break", pt: "Pausa" },
  LUNCH: { fr: "Déjeuner", en: "Lunch", pt: "Almoço" },
  CLOSING: { fr: "Clôture", en: "Closing", pt: "Encerramento" },
  SIDE_EVENT: { fr: "Événement parallèle", en: "Side event", pt: "Evento paralelo" },
};

const ETATS: Record<EtatSession, Trois> = {
  SANS_RESERVATION: { fr: "Sans réservation", en: "No booking needed", pt: "Sem reserva" },
  OUVERTE: { fr: "Ouvert", en: "Open", pt: "Aberto" },
  LISTE_ATTENTE: { fr: "Liste d'attente", en: "Waiting list", pt: "Lista de espera" },
  COMPLETE: { fr: "Complet", en: "Full", pt: "Esgotado" },
  CLOTUREE: { fr: "Clôturé", en: "Closed", pt: "Encerrado" },
};

const ROLES: Record<string, Trois> = {
  MODERATOR: { fr: "Modération", en: "Moderator", pt: "Moderação" },
  PANELIST: { fr: "Panéliste", en: "Panellist", pt: "Painelista" },
  KEYNOTE: { fr: "Intervention principale", en: "Keynote", pt: "Intervenção principal" },
};

export function libelleType(type: TypeSession, langue: string): string {
  return selon(langue, TYPES[type]);
}

export function libelleEtat(etat: EtatSession, langue: string): string {
  return selon(langue, ETATS[etat]);
}

export function libelleRole(role: string, langue: string): string {
  const libelles = ROLES[role];
  return libelles ? selon(langue, libelles) : role;
}
