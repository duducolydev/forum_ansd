"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmer } from "@/components/ui/confirmer";
import { deleteCheckpointAction, saveCheckpointAction, type ActionState } from "../actions";
import { Plus, Save, Trash2 } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";

const initialState: ActionState = {};

export interface CheckpointRow {
  id: string;
  name: string;
  zoneId: string;
  deviceLabel: string | null;
  isActive: boolean;
  scans: number;
}

const champ = "border-border bg-bg text-text rounded-lg border px-3 py-2 text-sm";

/**
 * Un point de contrôle = un poste physique rattaché à une zone (brief §15).
 *
 * Le libellé d'appareil n'est pas décoratif : le jour J, « tablette 3 » écrit au
 * marqueur sur une coque est le seul moyen de savoir quel poste a produit une
 * série de scans douteux.
 */
export function CheckpointRowForm({
  checkpoint,
  zones,
}: {
  checkpoint?: CheckpointRow;
  zones: { id: string; code: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(saveCheckpointAction, initialState);
  const [suppression, setSuppression] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();
  const router = useRouter();
  const suffixe = checkpoint?.id ?? "new";

  function supprimer() {
    if (!checkpoint) return;
    // Gestionnaire volontairement synchrone : un `onClick` déclaré `async`
    // renvoie une promesse que React ignore.
    void confirmer({
      titre: "Supprimer ce point de contrôle ?",
      texte: `« ${checkpoint.name} » ne pourra plus scanner. Les passages déjà enregistrés sont conservés.`,
      confirmer: "Supprimer",
      ton: "danger",
    }).then((accepte) => {
      if (!accepte) return;
      startTransition(async () => {
        const resultat = await deleteCheckpointAction(checkpoint.id);
        if (resultat.error) setSuppression(resultat.error);
        else router.refresh();
      });
    });
  }

  return (
    <form
      action={formAction}
      className="border-border bg-surface flex flex-wrap items-end gap-3 rounded-xl border p-3.5"
    >
      {checkpoint && <input type="hidden" name="id" value={checkpoint.id} />}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`cp-name-${suffixe}`} className="text-text-3 text-xs font-semibold">
          Nom du point
        </label>
        <input
          id={`cp-name-${suffixe}`}
          name="name"
          defaultValue={checkpoint?.name ?? ""}
          required
          maxLength={100}
          placeholder="Entrée principale — porte A"
          className={`${champ} w-64`}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`cp-zone-${suffixe}`} className="text-text-3 text-xs font-semibold">
          Zone contrôlée
        </label>
        <select
          id={`cp-zone-${suffixe}`}
          name="zoneId"
          defaultValue={checkpoint?.zoneId ?? ""}
          required
          className={`${champ} w-52`}
        >
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

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`cp-device-${suffixe}`} className="text-text-3 text-xs font-semibold">
          Appareil
        </label>
        <input
          id={`cp-device-${suffixe}`}
          name="deviceLabel"
          defaultValue={checkpoint?.deviceLabel ?? ""}
          maxLength={60}
          placeholder="Tablette 3"
          className={`${champ} w-40`}
        />
      </div>

      <label className="text-text-2 flex items-center gap-2 py-2 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={checkpoint?.isActive ?? true}
          className="accent-primary h-4 w-4"
        />
        Actif
      </label>

      <Bouton ton="principal" icone={checkpoint ? Save : Plus} type="submit" disabled={pending}>
        {checkpoint ? "Enregistrer" : "Ajouter"}
      </Bouton>

      {checkpoint && (
        <Bouton ton="danger" icone={Trash2} type="button" onClick={supprimer} disabled={enCours}>
          Supprimer
        </Bouton>
      )}

      {checkpoint && checkpoint.scans > 0 && (
        <p className="text-text-3 basis-full text-xs">{checkpoint.scans} scan(s) enregistré(s)</p>
      )}

      {(state.error || suppression) && (
        <p className="text-danger-text basis-full text-sm">{state.error ?? suppression}</p>
      )}
    </form>
  );
}
