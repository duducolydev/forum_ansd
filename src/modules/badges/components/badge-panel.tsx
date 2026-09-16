"use client";

import { BadgeCheck, FileDown, ImageDown, Printer, RefreshCw, ShieldOff } from "lucide-react";
import { Bouton, LienExterne } from "@/components/ui/bouton";
import { auClicConfirme } from "@/components/ui/confirmer";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  generateBadgeAction,
  recordPrintAction,
  reissueBadgeAction,
  revokeBadgeAction,
  type BadgeActionState,
} from "../actions";

export interface BadgeRow {
  id: string;
  version: number;
  generatedAt: string | null;
  revokedAt: string | null;
  revokeReason: string | null;
  printedCount: number;
  downloadedAt: string | null;
  hasFiles: boolean;
}

interface Props {
  participantId: string;
  badges: BadgeRow[];
  canGenerate: boolean;
  canRevoke: boolean;
  canPrint: boolean;
}

export function BadgePanel({ participantId, badges, canGenerate, canRevoke, canPrint }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<BadgeActionState>({});
  const [reissueOpen, setReissueOpen] = useState(false);
  const [reason, setReason] = useState("");

  const current = badges.find((badge) => !badge.revokedAt) ?? null;

  function run(action: () => Promise<BadgeActionState>) {
    setState({});
    startTransition(async () => {
      const result = await action();
      setState(result);
      if (result.success) {
        setReissueOpen(false);
        setReason("");
        router.refresh();
      }
    });
  }

  return (
    <div className="border-border bg-surface mt-5 rounded-xl border p-5">
      <h3 className="text-heading mb-3 text-sm font-semibold">Badge</h3>

      {badges.length === 0 ? (
        <p className="text-text-2 mb-3 text-sm">Aucun badge généré pour ce participant.</p>
      ) : (
        <ul className="mb-4 flex flex-col gap-2 text-sm">
          {badges.map((badge) => (
            <li
              key={badge.id}
              className="border-border flex flex-wrap items-center gap-x-3 gap-y-1 border-b pb-2 last:border-0"
            >
              <b className="text-heading">v{badge.version}</b>
              {badge.revokedAt ? (
                <span className="bg-danger-soft text-danger-text rounded-md px-2 py-0.5 text-xs font-semibold">
                  Révoqué
                </span>
              ) : (
                <span className="bg-accent-soft text-accent-text rounded-md px-2 py-0.5 text-xs font-semibold">
                  Actif
                </span>
              )}
              <span className="text-text-3">
                {badge.generatedAt
                  ? `généré le ${new Date(badge.generatedAt).toLocaleString("fr-FR")}`
                  : "en attente de génération"}
              </span>
              <span className="text-text-3">· {badge.printedCount} impression(s)</span>
              {badge.revokeReason && (
                <span className="text-text-3 basis-full">Motif : {badge.revokeReason}</span>
              )}
              {badge.hasFiles && (
                <span className="flex basis-full gap-1.5 pt-1">
                  {/* `<a>` et non `<Link>` : ce sont des routes d'API qui
                      renvoient un fichier, pas des pages à naviguer. */}
                  <LienExterne
                    href={`/api/v1/badges/${badge.id}/pdf`}
                    ton="secondaire"
                    taille="petit"
                    icone={FileDown}
                  >
                    PDF
                  </LienExterne>
                  <LienExterne
                    href={`/api/v1/badges/${badge.id}/png`}
                    ton="secondaire"
                    taille="petit"
                    icone={ImageDown}
                  >
                    PNG
                  </LienExterne>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        {canGenerate && (
          <Bouton
            ton="principal"
            icone={current ? RefreshCw : BadgeCheck}
            disabled={pending}
            onClick={() => run(() => generateBadgeAction(participantId))}
          >
            {current ? "Régénérer (même version)" : "Générer le badge"}
          </Bouton>
        )}
        {canPrint && current?.hasFiles && (
          <Bouton
            icone={Printer}
            disabled={pending}
            onClick={() => run(() => recordPrintAction(current.id, participantId))}
          >
            Enregistrer une impression
          </Bouton>
        )}
        {canRevoke && current && (
          <Bouton
            ton="danger"
            icone={ShieldOff}
            disabled={pending}
            onClick={() => setReissueOpen((open) => !open)}
          >
            Révoquer / réémettre
          </Bouton>
        )}
      </div>

      {reissueOpen && current && (
        <div className="border-border mt-4 flex flex-col gap-3 rounded-lg border p-4">
          <label htmlFor="reason" className="text-heading text-sm font-semibold">
            Motif (badge perdu, erreur de saisie, exclusion…)
          </label>
          <input
            id="reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="border-border bg-surface text-text rounded-lg border px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Bouton
              ton="principal"
              icone={RefreshCw}
              disabled={pending}
              onClick={() => run(() => reissueBadgeAction(participantId, reason))}
            >
              Réémettre en v{current.version + 1}
            </Bouton>
            {/* Révoquer sans réémettre laisse la personne sans badge valide le
                jour J : c'est le geste le plus lourd de cet écran. */}
            <Bouton
              ton="danger"
              icone={ShieldOff}
              disabled={pending}
              onClick={auClicConfirme(
                {
                  titre: `Révoquer le badge v${current.version} ?`,
                  texte:
                    "Aucun nouveau badge ne sera émis : le QR cesse immédiatement d'être valide et la personne se verra refuser l'accès à tous les points de contrôle.",
                  confirmer: "Révoquer",
                  ton: "danger",
                },
                () => run(() => revokeBadgeAction(current.id, participantId, reason)),
              )}
            >
              Révoquer sans réémettre
            </Bouton>
          </div>
          <p className="text-text-3 text-xs">
            Dans les deux cas, le QR de la version {current.version} cesse immédiatement d&apos;être
            valide.
          </p>
        </div>
      )}

      {state.error && <p className="text-danger-text mt-3 text-sm">{state.error}</p>}
      {state.success && <p className="text-accent-text mt-3 text-sm">{state.success}</p>}
      {pending && <p className="text-text-3 mt-3 text-sm">Rendu en cours…</p>}
    </div>
  );
}
