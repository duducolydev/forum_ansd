const LABELS: Record<string, { label: string; className: string }> = {
  QUEUED: { label: "En file", className: "bg-bg-3 text-text-2" },
  SENT: { label: "Envoyé", className: "bg-accent-soft text-accent-text" },
  FAILED: { label: "Échec", className: "bg-danger-soft text-danger-text" },
  BOUNCED: { label: "Rebond", className: "bg-warn-soft text-warn-text" },
};

export function LogStatusBadge({ status }: { status: string }) {
  const tone = LABELS[status] ?? { label: status, className: "bg-bg-3 text-text-2" };
  return (
    <span
      className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${tone.className}`}
    >
      {tone.label}
    </span>
  );
}
