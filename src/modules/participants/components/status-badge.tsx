import type { ParticipantStatus } from "@prisma/client";

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

export function StatusBadge({ status }: { status: ParticipantStatus }) {
  return (
    <span
      className={`inline-block rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${STATUS_CLASSES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
