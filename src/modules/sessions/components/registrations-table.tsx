"use client";

import { useActionState, useState, useTransition } from "react";
import { auClicConfirme } from "@/components/ui/confirmer";
import { useRouter } from "next/navigation";
import type { LigneInscription } from "../registration";
import { UserCheck, UserPlus, UserX, X } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import {
  inscrireManuellementAction,
  marquerPresentAction,
  retirerAction,
  type ActionState,
} from "../registration-actions";

const initialState: ActionState = {};

const STATUT_LABEL: Record<LigneInscription["statut"], string> = {
  REGISTERED: "Inscrit",
  ATTENDED: "Présent",
  WAITLISTED: "Liste d'attente",
  CANCELLED: "Annulé",
};

const STATUT_COULEUR: Record<LigneInscription["statut"], string> = {
  REGISTERED: "bg-blue-soft text-blue-text",
  ATTENDED: "bg-accent-soft text-accent-text",
  WAITLISTED: "bg-warn-soft text-warn-text",
  CANCELLED: "bg-danger-soft text-danger-text",
};

/**
 * Liste des inscrits d'une session, avec placement manuel et pointage.
 *
 * Les annulations restent affichées : savoir que quelqu'un s'était inscrit puis
 * s'est retiré est une information, et une liste qui les efface donne
 * l'impression d'une session qui n'a jamais intéressé personne.
 */
export function RegistrationsTable({
  sessionId,
  lignes,
}: {
  sessionId: string;
  lignes: LigneInscription[];
}) {
  const [state, formAction, pending] = useActionState(inscrireManuellementAction, initialState);
  const [erreur, setErreur] = useState<string | null>(null);
  const [avis, setAvis] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();
  const router = useRouter();

  function lancer(action: () => Promise<ActionState>) {
    setErreur(null);
    setAvis(null);
    startTransition(async () => {
      const resultat = await action();
      if (resultat.error) {
        setErreur(resultat.error);
        return;
      }
      // Le message compte autant que l'action : retirer un inscrit promeut la
      // première personne en attente et lui envoie un courriel. L'agent doit
      // savoir qu'un message est parti à cause de son clic.
      if (resultat.message) setAvis(resultat.message);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <form
        action={formAction}
        className="border-border bg-surface flex flex-wrap items-end gap-3 rounded-xl border p-3.5"
      >
        <input type="hidden" name="sessionId" value={sessionId} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="publicId" className="text-text-3 text-xs font-semibold">
            Inscrire un participant (identifiant du badge)
          </label>
          <input
            id="publicId"
            name="publicId"
            required
            placeholder="FID26-7K3M2P"
            className="border-border bg-bg text-text w-48 rounded-lg border px-3 py-2 font-mono text-sm uppercase"
          />
        </div>
        <Bouton ton="principal" icone={UserPlus} type="submit" disabled={pending}>
          Inscrire
        </Bouton>
        {state.error && <p className="text-danger-text basis-full text-sm">{state.error}</p>}
        {state.message && !state.error && (
          <p className="text-text-3 basis-full text-sm">{state.message}</p>
        )}
      </form>

      {erreur && <p className="text-danger-text text-sm">{erreur}</p>}
      {avis && (
        <p role="status" className="text-text-2 text-sm">
          {avis}
        </p>
      )}

      {lignes.length === 0 ? (
        <p className="text-text-2 text-sm">Aucune inscription pour l&apos;instant.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-text-3 text-xs">
                <th scope="col" className="px-2 py-2 text-left font-semibold">
                  Participant
                </th>
                <th scope="col" className="px-2 py-2 text-left font-semibold">
                  Catégorie
                </th>
                <th scope="col" className="px-2 py-2 text-left font-semibold">
                  Statut
                </th>
                <th scope="col" className="px-2 py-2 text-right font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((ligne) => (
                <tr key={ligne.participantId} className="border-border border-t">
                  <td className="px-2 py-2">
                    <span className="text-heading block font-medium">{ligne.nom}</span>
                    <span className="text-text-3 font-mono text-xs">
                      {ligne.publicId}
                      {ligne.organisation ? ` · ${ligne.organisation}` : ""}
                    </span>
                  </td>
                  <td className="text-text-2 px-2 py-2">{ligne.categorie}</td>
                  <td className="px-2 py-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-semibold ${STATUT_COULEUR[ligne.statut]}`}
                    >
                      {STATUT_LABEL[ligne.statut]}
                      {ligne.position !== null && ` · ${ligne.position}`}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right whitespace-nowrap">
                    {(ligne.statut === "REGISTERED" || ligne.statut === "ATTENDED") && (
                      <Bouton
                        ton="discret"
                        /* L'icône suit le sens de l'action, pas le mot
                           « retirer » : pointer une présence et l'annuler sont
                           deux gestes opposés. */
                        icone={ligne.statut === "ATTENDED" ? UserX : UserCheck}
                        type="button"
                        disabled={enCours}
                        onClick={() =>
                          lancer(() =>
                            marquerPresentAction(
                              sessionId,
                              ligne.participantId,
                              ligne.statut !== "ATTENDED",
                            ),
                          )
                        }
                        className="mr-3"
                      >
                        {ligne.statut === "ATTENDED" ? "Retirer la présence" : "Marquer présent"}
                      </Bouton>
                    )}
                    {ligne.statut !== "CANCELLED" && (
                      <Bouton
                        ton="danger"
                        icone={X}
                        type="button"
                        disabled={enCours}
                        onClick={auClicConfirme(
                          {
                            titre: "Retirer cette personne du panel ?",
                            texte: `${ligne.nom} perdra sa place. Si une liste d'attente existe, la première personne sera promue et prévenue par courriel.`,
                            confirmer: "Retirer",
                            ton: "danger",
                          },
                          () => lancer(() => retirerAction(sessionId, ligne.participantId)),
                        )}
                      >
                        Retirer
                      </Bouton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
