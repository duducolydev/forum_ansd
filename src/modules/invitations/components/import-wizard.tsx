"use client";

import { useActionState } from "react";
import { Check, Eye } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import {
  confirmImportAction,
  previewImportAction,
  type ActionState,
  type ImportPreviewState,
} from "../actions";

const previewInitial: ImportPreviewState = {};
const confirmInitial: ActionState = {};

export function ImportWizard() {
  const [preview, previewAction, previewPending] = useActionState(
    previewImportAction,
    previewInitial,
  );
  const [confirmState, confirmAction, confirmPending] = useActionState(
    confirmImportAction,
    confirmInitial,
  );

  if (confirmState.success) {
    return (
      <div className="border-accent-text bg-accent-soft text-accent-text rounded-xl border p-5">
        {confirmState.success}
      </div>
    );
  }

  if (!preview.batchToken) {
    return (
      <form action={previewAction} className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="file" className="text-heading text-sm font-semibold">
            Fichier Excel/CSV
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".xlsx,.xls,.csv"
            required
            className="border-border bg-surface text-text rounded-lg border px-3 py-2.5"
          />
          <p className="text-text-3 text-xs">
            Colonnes attendues : email, prenom, nom, organisation (optionnel), pays (optionnel),
            categorie (code exact, ex. <code>PARTICIPANT_INTERNATIONAL</code>).
          </p>
        </div>
        {preview.error && <p className="text-danger-text text-sm">{preview.error}</p>}
        <div>
          <Bouton ton="principal" icone={Eye} type="submit" disabled={previewPending}>
            {previewPending ? "Analyse…" : "Prévisualiser"}
          </Bouton>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="border-border bg-surface rounded-xl border p-5">
        <p className="text-heading mb-2 text-sm font-semibold">
          {preview.validCount} ligne(s) valide(s) prête(s) à importer.
        </p>
        {preview.errors && preview.errors.length > 0 && (
          <details className="mt-3">
            <summary className="text-warn-text cursor-pointer text-sm font-semibold">
              {preview.errors.length} ligne(s) ignorée(s) — détail
            </summary>
            <ul className="text-text-2 mt-2 max-h-60 overflow-y-auto text-sm">
              {preview.errors.map((err, index) => (
                <li key={index}>
                  Ligne {err.rowNumber} : {err.message}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <form action={confirmAction} className="flex items-center gap-3">
        <input type="hidden" name="batchToken" value={preview.batchToken} />
        {confirmState.error && <p className="text-danger-text text-sm">{confirmState.error}</p>}
        <Bouton
          ton="principal"
          icone={Check}
          type="submit"
          disabled={confirmPending || (preview.validCount ?? 0) === 0}
        >
          {confirmPending ? "Import…" : `Confirmer l'import (${preview.validCount ?? 0})`}
        </Bouton>
      </form>
    </div>
  );
}
