"use client";
import { BadgeCheck, Check, CircleSlash, RotateCcw, X, type LucideIcon } from "lucide-react";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ParticipantStatus } from "@prisma/client";
import { confirmer, type OptionsConfirmation } from "@/components/ui/confirmer";
import {
  cancelParticipantAction,
  confirmParticipantAction,
  declineParticipantAction,
  reactivateParticipantAction,
} from "../actions";

type Transition = {
  label: string;
  icone: LucideIcon;
  run: (id: string) => Promise<{ error?: string }>;
  className: string;
  /** Question posée avant d'agir (1er octobre 2026) : annuler ou décliner se fait sur confirmation. */
  confirmation?: OptionsConfirmation;
};

const CONFIRMATION_ANNULATION: OptionsConfirmation = {
  titre: "Annuler cette participation ?",
  texte:
    "Le badge devient invalide au contrôle et l'espace personnel se ferme. Une erreur se rattrape avec « Réactiver ».",
  confirmer: "Annuler la participation",
  annuler: "Ne rien faire",
  ton: "danger",
};

/** Annulation ou refus faits par erreur : on revient à l'état d'avant. */
const REACTIVER: Transition = {
  label: "Réactiver",
  icone: RotateCcw,
  run: reactivateParticipantAction,
  className: "bg-primary text-primary-text hover:bg-primary-hover",
  confirmation: {
    titre: "Réactiver ce participant ?",
    texte:
      "Il retrouve son statut d'avant l'annulation (inscrit, confirmé ou badgé), son badge et l'accès à son espace. Aucun e-mail n'est envoyé.",
    confirmer: "Réactiver",
    ton: "neutre",
  },
};

const ACTIONS: Partial<Record<ParticipantStatus, Transition[]>> = {
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
      confirmation: {
        titre: "Décliner cette inscription ?",
        texte:
          "La personne ne pourra plus accéder à son espace. Une erreur se rattrape avec « Réactiver ».",
        confirmer: "Décliner",
        ton: "danger",
      },
    },
  ],
  CONFIRMED: [
    {
      label: "Annuler la participation",
      icone: CircleSlash,
      run: cancelParticipantAction,
      className: "border border-danger-text text-danger-text",
      confirmation: CONFIRMATION_ANNULATION,
    },
  ],
  BADGED: [
    {
      label: "Annuler la participation",
      icone: CircleSlash,
      run: cancelParticipantAction,
      className: "border border-danger-text text-danger-text",
      confirmation: CONFIRMATION_ANNULATION,
    },
  ],
  CANCELLED: [REACTIVER],
  DECLINED: [REACTIVER],
};

/**
 * Presse (catégorie « Accréditation requise ») : la validation s'appelle
 * « Accréditer ». C'est la même transition — elle date l'accréditation,
 * l'imprime sur le badge et envoie l'e-mail d'accréditation accordée.
 */
const ACCREDITER: Transition = {
  label: "Accréditer",
  icone: BadgeCheck,
  run: confirmParticipantAction,
  className: "bg-primary text-primary-text hover:bg-primary-hover",
};

export function TransitionActions({
  participantId,
  status,
  accreditation = false,
  peutAccrediter = false,
}: {
  participantId: string;
  status: ParticipantStatus;
  /** Catégorie soumise à accréditation (presse). */
  accreditation?: boolean;
  /** Permission `participants.accredit` : réservée à l'administration. */
  peutAccrediter?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Presse : « Accréditer » remplace « Confirmer », et disparaît pour qui n'a
  // pas le droit d'accréditer (l'agent d'accueil, notamment).
  const actions = (ACTIONS[status] ?? []).flatMap((action) =>
    accreditation && action.run === confirmParticipantAction
      ? peutAccrediter
        ? [ACCREDITER]
        : []
      : [action],
  );
  const accreditationRefusee = accreditation && !peutAccrediter && status === "REGISTERED";
  if (actions.length === 0 && !accreditationRefusee) return null;

  function run(
    action: (id: string) => Promise<{ error?: string }>,
    confirmation?: OptionsConfirmation,
  ) {
    setError(null);
    if (confirmation) {
      void confirmer(confirmation).then((accepte) => {
        if (accepte) executer(action);
      });
      return;
    }
    executer(action);
  }

  function executer(action: (id: string) => Promise<{ error?: string }>) {
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
            onClick={() => run(action.run, action.confirmation)}
            className={`transition-tout inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60 ${action.className}`}
          >
            <action.icone aria-hidden size={15} strokeWidth={2.2} />
            {action.label}
          </button>
        ))}
      </div>
      {accreditationRefusee && (
        <p className="text-text-3 text-sm">
          L&apos;accréditation presse est réservée à l&apos;administration du Forum.
        </p>
      )}
      {error && <p className="text-danger-text text-sm">{error}</p>}
    </div>
  );
}
