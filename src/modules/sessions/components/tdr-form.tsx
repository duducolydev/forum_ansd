"use client";

import { useActionState, useState, useTransition } from "react";
import { auClicConfirme } from "@/components/ui/confirmer";
import { useRouter } from "next/navigation";
import { removeTdrAction, uploadTdrAction, type ActionState } from "../actions";
import { Upload, X } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";

const initialState: ActionState = {};

/**
 * Dépôt des termes de référence (brief §5.8).
 *
 * Séparé du formulaire principal, et non fondu dedans : un envoi de fichier
 * échoue pour ses propres raisons — trop lourd, mauvais format — et les mêler
 * aux vingt champs de la session ferait perdre la saisie en cours à chaque
 * refus.
 */
export function TdrForm({ id, present }: { id: string; present: boolean }) {
  const [state, formAction, pending] = useActionState(uploadTdrAction, initialState);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();
  const router = useRouter();

  return (
    <section className="border-border bg-surface rounded-xl border p-5">
      <h3 className="text-heading mb-1 text-sm font-semibold">Termes de référence</h3>
      <p className="text-text-3 mb-4 text-xs">
        PDF uniquement, 8 Mo au plus. Le document est téléchargeable depuis la fiche publique dès
        que la session est publiée.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <form action={formAction} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="id" value={id} />
          <input
            type="file"
            name="tdr"
            accept="application/pdf"
            required
            className="text-text-2 text-sm"
          />
          <Bouton ton="secondaire" icone={Upload} type="submit" disabled={pending}>
            {pending ? "Envoi…" : present ? "Remplacer" : "Déposer"}
          </Bouton>
        </form>

        {present && (
          <>
            <a
              href={`/api/v1/sessions/${id}/tdr`}
              target="_blank"
              rel="noopener"
              className="text-link text-sm font-semibold"
            >
              Voir le PDF
            </a>
            <Bouton
              ton="danger"
              icone={X}
              type="button"
              disabled={enCours}
              onClick={auClicConfirme(
                {
                  titre: "Retirer les termes de référence ?",
                  texte: "Le document ne sera plus téléchargeable depuis la fiche publique.",
                  confirmer: "Retirer",
                  ton: "danger",
                },
                () =>
                  startTransition(async () => {
                    const resultat = await removeTdrAction(id);
                    if (resultat.error) setErreur(resultat.error);
                    else router.refresh();
                  }),
              )}
            >
              Retirer
            </Bouton>
          </>
        )}
      </div>

      {(state.error || erreur) && (
        <p className="text-danger-text mt-2 text-sm">{state.error ?? erreur}</p>
      )}
      {state.message && !state.error && <p className="text-text-3 mt-2 text-sm">{state.message}</p>}
    </section>
  );
}
