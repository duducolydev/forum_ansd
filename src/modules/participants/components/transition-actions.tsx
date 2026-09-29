"use client";
import { BadgeCheck, Check, CircleSlash, X, type LucideIcon } from "lucide-react";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ParticipantStatus } from "@prisma/client";
import {
  cancelParticipantAction,
  confirmParticipantAction,
  declineParticipantAction,
} from "../actions";

const ACTIONS: Partial<
  Record<
    ParticipantStatus,
    {
      label: string;
      icone: LucideIcon;
      run: (id: string) => Promise<{ error?: string }>;
      className: string;
    }[]
  >
> = {
  REGISTERED: [
    {
      label: "Confirmer",
      icone: Check,
      run: confirmParticipantAction,
      className: "bg-primary text-primary-text hover:bg-primary-hover",
    },
    {
      label: "Décliner",
      icone: X,
      run: declineParticipantAction,
      className: "border border-border text-heading",
    },
  ],
  CONFIRMED: [
    {
      label: "Annuler la participation",
      icone: CircleSlash,
      run: cancelParticipantAction,
      className: "border border-danger-text text-danger-text",
    },
  ],
  BADGED: [
    {
      label: "Annuler la participation",
      icone: CircleSlash,
      run: cancelParticipantAction,
      className: "border border-danger-text text-danger-text",
    },
  ],
};

/**
 * Presse (catégorie « Accréditation requise ») : la validation s'appelle
 * « Accréditer ». C'est la même transition — elle date l'accréditation,
 * l'imprime sur le badge et envoie l'e-mail d'accréditation accordée.
 */
const ACCREDITER = {
  label: "Accréditer",
  icone: BadgeCheck,
  run: confirmParticipantAction,
  className: "bg-primary text-primary-text hover:bg-primary-hover",
};

export function TransitionActions({
  participantId,
  status,
  accreditation = false,
}: {
  participantId: string;
  status: ParticipantStatus;
  /** Catégorie soumise à accréditation (presse). */
  accreditation?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const actions = (ACTIONS[status] ?? []).map((action) =>
    accreditation && action.run === confirmParticipantAction ? ACCREDITER : action,
  );
  if (actions.length === 0) return null;

  function run(action: (id: string) => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action(participantId);
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            disabled={isPending}
            onClick={() => run(action.run)}
            className={`transition-tout inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60 ${action.className}`}
          >
            <action.icone aria-hidden size={15} strokeWidth={2.2} />
            {action.label}
          </button>
        ))}
      </div>
      {error && <p className="text-danger-text text-sm">{error}</p>}
    </div>
  );
}
