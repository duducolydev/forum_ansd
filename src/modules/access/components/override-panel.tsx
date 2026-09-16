"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmer } from "@/components/ui/confirmer";
import { grantOverrideAction, revokeOverrideAction, type ActionState } from "../actions";
import { KeyRound, X } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";

const initialState: ActionState = {};

export interface OverrideRow {
  id: string;
  createdAt: string;
  zoneCode: string;
  zoneName: string;
  participantPublicId: string;
  participantName: string;
  organization: string | null;
  reason: string | null;
  grantedBy: string | null;
}

const champ = "border-border bg-bg text-text rounded-lg border px-3 py-2 text-sm";

/**
 * Exceptions individuelles (brief §2.6) : un accès supplémentaire ponctuel,
 * accordé à une personne nommée, avec un motif écrit et l'auteur tracé.
 *
 * L'écran affiche le motif en clair dans la liste, à dessein : une exception
 * qu'on n'ose pas afficher est une exception qu'il ne fallait pas accorder.
 */
export function OverridePanel({
  overrides,
  zones,
}: {
  overrides: OverrideRow[];
  zones: { id: string; code: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(grantOverrideAction, initialState);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();
  const router = useRouter();

  function retirer(id: string, publicId: string, zoneCode: string) {
    void confirmer({
      titre: "Retirer cette exception ?",
      texte: `${publicId} perdra l'accès à la zone ${zoneCode} dès le prochain scan.`,
      confirmer: "Retirer l'accès",
      ton: "danger",
    }).then((accepte) => {
      if (!accepte) return;
      startTransition(async () => {
        const resultat = await revokeOverrideAction(id);
        if (resultat.error) setErreur(resultat.error);
        else router.refresh();
      });
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        action={formAction}
        className="border-border bg-surface flex flex-wrap items-end gap-3 rounded-xl border p-3.5"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ov-participant" className="text-text-3 text-xs font-semibold">
            Identifiant participant
          </label>
          <input
            id="ov-participant"
            name="participantPublicId"
            required
            placeholder="FID26-7K3M2P"
            className={`${champ} w-44 font-mono uppercase`}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="ov-zone" className="text-text-3 text-xs font-semibold">
            Zone accordée
          </label>
          <select id="ov-zone" name="zoneId" required defaultValue="" className={`${champ} w-52`}>
            <option value="" disabled>
              Choisir…
            </option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <label htmlFor="ov-reason" className="text-text-3 text-xs font-semibold">
            Motif (obligatoire)
          </label>
          <input
            id="ov-reason"
            name="reason"
            required
            maxLength={300}
            placeholder="Accompagne la délégation ministérielle"
            className={`${champ} w-full`}
          />
        </div>

        <Bouton ton="principal" icone={KeyRound} type="submit" disabled={pending}>
          Accorder
        </Bouton>

        {state.error && <p className="text-danger-text basis-full text-sm">{state.error}</p>}
      </form>

      {erreur && <p className="text-danger-text text-sm">{erreur}</p>}

      {overrides.length === 0 ? (
        <p className="text-text-3 text-sm">Aucune exception accordée.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-text-3 text-xs">
                <th scope="col" className="px-2 py-2 text-left font-semibold">
                  Participant
                </th>
                <th scope="col" className="px-2 py-2 text-left font-semibold">
                  Zone
                </th>
                <th scope="col" className="px-2 py-2 text-left font-semibold">
                  Motif
                </th>
                <th scope="col" className="px-2 py-2 text-left font-semibold">
                  Accordé par
                </th>
                <th scope="col" className="px-2 py-2 text-right font-semibold">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {overrides.map((ligne) => (
                <tr key={ligne.id} className="border-border border-t">
                  <td className="px-2 py-2">
                    <span className="text-heading block font-medium">{ligne.participantName}</span>
                    <span className="text-text-3 font-mono text-xs">
                      {ligne.participantPublicId}
                      {ligne.organization ? ` · ${ligne.organization}` : ""}
                    </span>
                  </td>
                  <td className="px-2 py-2">{ligne.zoneName}</td>
                  <td className="text-text-2 px-2 py-2">{ligne.reason ?? "—"}</td>
                  <td className="text-text-3 px-2 py-2 text-xs">
                    {ligne.grantedBy ?? "—"}
                    <span className="block">{ligne.createdAt}</span>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <Bouton
                      ton="danger"
                      icone={X}
                      type="button"
                      disabled={enCours}
                      onClick={() => retirer(ligne.id, ligne.participantPublicId, ligne.zoneCode)}
                    >
                      Retirer
                    </Bouton>
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
