"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmer } from "@/components/ui/confirmer";
import { deleteRoomAction, saveRoomAction, type ActionState } from "../actions";
import { Plus, Save, Trash2 } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";

const initialState: ActionState = {};
const champ = "border-border bg-bg text-text rounded-lg border px-3 py-2 text-sm";

export interface RoomRow {
  id: string;
  name: string;
  capacity: number | null;
  floor: string | null;
  sessions: number;
}

/**
 * Une salle par ligne éditable. La capacité n'est pas décorative : c'est elle
 * qui donne son échelle au taux de remplissage d'une session.
 */
export function RoomRowForm({ salle }: { salle?: RoomRow }) {
  const [state, formAction, pending] = useActionState(saveRoomAction, initialState);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();
  const router = useRouter();
  const suffixe = salle?.id ?? "new";

  function supprimer() {
    if (!salle) return;
    void confirmer({
      titre: "Supprimer cette salle ?",
      texte: `« ${salle.name} » ne pourra plus être affectée à une session.`,
      confirmer: "Supprimer",
      ton: "danger",
    }).then((accepte) => {
      if (!accepte) return;
      startTransition(async () => {
        const resultat = await deleteRoomAction(salle.id);
        if (resultat.error) setErreur(resultat.error);
        else router.refresh();
      });
    });
  }

  return (
    <form
      action={formAction}
      className="border-border bg-surface flex flex-wrap items-end gap-3 rounded-xl border p-3.5"
    >
      {salle && <input type="hidden" name="id" value={salle.id} />}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`salle-nom-${suffixe}`} className="text-text-3 text-xs font-semibold">
          Nom de la salle
        </label>
        <input
          id={`salle-nom-${suffixe}`}
          name="name"
          required
          maxLength={100}
          defaultValue={salle?.name ?? ""}
          placeholder="Salle plénière"
          className={`${champ} w-56`}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`salle-cap-${suffixe}`} className="text-text-3 text-xs font-semibold">
          Capacité
        </label>
        <input
          id={`salle-cap-${suffixe}`}
          name="capacity"
          type="number"
          min={1}
          defaultValue={salle?.capacity ?? ""}
          className={`${champ} w-28`}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`salle-etage-${suffixe}`} className="text-text-3 text-xs font-semibold">
          Niveau
        </label>
        <input
          id={`salle-etage-${suffixe}`}
          name="floor"
          maxLength={40}
          defaultValue={salle?.floor ?? ""}
          placeholder="Rez-de-chaussée"
          className={`${champ} w-44`}
        />
      </div>

      <Bouton ton="principal" icone={salle ? Save : Plus} type="submit" disabled={pending}>
        {salle ? "Enregistrer" : "Ajouter"}
      </Bouton>

      {salle && (
        <Bouton ton="danger" icone={Trash2} type="button" onClick={supprimer} disabled={enCours}>
          Supprimer
        </Bouton>
      )}

      {salle && salle.sessions > 0 && (
        <p className="text-text-3 basis-full text-xs">{salle.sessions} session(s) programmée(s)</p>
      )}

      {(state.error || erreur) && (
        <p className="text-danger-text basis-full text-sm">{state.error ?? erreur}</p>
      )}
    </form>
  );
}
