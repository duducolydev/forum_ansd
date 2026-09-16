import type { InvitationStatus } from "@prisma/client";

const LABELS: Record<InvitationStatus, string> = {
  PENDING: "À envoyer",
  SENT: "Envoyée",
  OPENED: "Ouverte",
  CLICKED: "Cliquée",
  REGISTERED: "Inscrit(e)",
  DECLINED: "Déclinée",
  EXPIRED: "Expirée",
};

const CLASSES: Record<InvitationStatus, string> = {
  PENDING: "bg-bg-3 text-text-2",
  SENT: "bg-blue-soft text-blue-text",
  OPENED: "bg-blue-soft text-blue-text",
  CLICKED: "bg-warn-soft text-warn-text",
  REGISTERED: "bg-accent-soft text-accent-text",
  DECLINED: "bg-danger-soft text-danger-text",
  EXPIRED: "bg-danger-soft text-danger-text",
};

export function InvitationStatusBadge({ status }: { status: InvitationStatus }) {
  return (
    <span
      className={`inline-block rounded-md px-2.5 py-1 text-xs font-semibold ${CLASSES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
