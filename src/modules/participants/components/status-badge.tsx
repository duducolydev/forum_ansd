import type { ParticipantStatus } from "@prisma/client";
import type { Langue } from "@/lib/langue";

export const STATUS_LABELS: Record<ParticipantStatus, string> = {
  INVITED: "Invité",
  INVITATION_SENT: "Invitation envoyée",
  REGISTRATION_STARTED: "Inscription en cours",
  REGISTERED: "En attente de validation",
  CONFIRMED: "Confirmé",
  BADGED: "Badgé",
  CHECKED_IN: "Présent",
  DECLINED: "Décliné",
  CANCELLED: "Annulé",
};

/** Libellés de l'espace participant ; le BackOffice garde les libellés français. */
const STATUS_LABELS_TRADUITS: Record<"en" | "pt", Record<ParticipantStatus, string>> = {
  en: {
    INVITED: "Invited",
    INVITATION_SENT: "Invitation sent",
    REGISTRATION_STARTED: "Registration in progress",
    REGISTERED: "Awaiting validation",
    CONFIRMED: "Confirmed",
    BADGED: "Badge issued",
    CHECKED_IN: "Present",
    DECLINED: "Declined",
    CANCELLED: "Cancelled",
  },
  pt: {
    INVITED: "Convidado",
    INVITATION_SENT: "Convite enviado",
    REGISTRATION_STARTED: "Inscrição em curso",
    REGISTERED: "A aguardar validação",
    CONFIRMED: "Confirmado",
    BADGED: "Crachá emitido",
    CHECKED_IN: "Presente",
    DECLINED: "Recusado",
    CANCELLED: "Cancelado",
  },
};

const STATUS_CLASSES: Record<ParticipantStatus, string> = {
  INVITED: "bg-bg-3 text-text-2",
  INVITATION_SENT: "bg-bg-3 text-text-2",
  REGISTRATION_STARTED: "bg-blue-soft text-blue-text",
  REGISTERED: "bg-warn-soft text-warn-text",
  CONFIRMED: "bg-accent-soft text-accent-text",
  BADGED: "bg-gold-soft text-gold-text",
  CHECKED_IN: "bg-ansd-bleu-nuit text-white",
  DECLINED: "bg-danger-soft text-danger-text",
  CANCELLED: "bg-danger-soft text-danger-text",
};

export function StatusBadge({
  status,
  langue = "fr",
}: {
  status: ParticipantStatus;
  langue?: Langue;
}) {
  return (
    <span
      className={`inline-block rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${STATUS_CLASSES[status]}`}
    >
      {langue === "fr" ? STATUS_LABELS[status] : STATUS_LABELS_TRADUITS[langue][status]}
    </span>
  );
}
