"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmer } from "@/components/ui/confirmer";
import { deleteZoneAction, saveZoneAction, type ActionState } from "../actions";
import { Plus, Save, Trash2 } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";

const initialState: ActionState = {};

export interface ZoneRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  checkpoints: number;
  categories: number;
  overrides: number;
}

const champ = "border-border bg-bg text-text rounded-lg border px-3 py-2 text-sm";

/**
 * Une ligne de zone est un formulaire à part entière : la table des zones
 * s'édite sur place, sans écran intermédiaire. `zone` absent = ligne de
 * création.
 */
export function ZoneRowForm({ zone }: { zone?: ZoneRow }) {
  const [state, formAction, pending] = useActionState(saveZoneAction, initialState);
  const [suppression, setSuppression] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();
  const router = useRouter();

  function supprimer() {
    if (!zone) return;
    const perdu: string[] = [];
    if (zone.categories > 0) perdu.push(`${zone.categories} ligne(s) de matrice`);
    if (zone.overrides > 0) perdu.push(`${zone.overrides} exception(s) individuelle(s)`);
    // Le titre pose déjà la question : ce texte n'énonce que les conséquences.
    const avertissement =
      perdu.length > 0
        ? `Cela retirera aussi ${perdu.join(" et ")}.`
        : "Aucune ligne de matrice ni exception n'y est rattachée.";
    void confirmer({
      titre: `Supprimer la zone ${zone.code} ?`,
      texte: avertissement,
      confirmer: "Supprimer",
      ton: "danger",
    }).then((accepte) => {
      if (!accepte) return;
      startTransition(async () => {
        const resultat = await deleteZoneAction(zone.id);
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
      {zone && <input type="hidden" name="id" value={zone.id} />}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`code-${zone?.id ?? "new"}`} className="text-text-3 text-xs font-semibold">
          Code
        </label>
        <input
          id={`code-${zone?.id ?? "new"}`}
          name="code"
          defaultValue={zone?.code ?? ""}
          required
          maxLength={30}
          placeholder="PLENIERE"
          className={`${champ} w-36 font-mono uppercase`}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`name-${zone?.id ?? "new"}`} className="text-text-3 text-xs font-semibold">
          Nom
        </label>
        <input
          id={`name-${zone?.id ?? "new"}`}
          name="name"
          defaultValue={zone?.name ?? ""}
          required
          maxLength={100}
          className={`${champ} w-56`}
        />
      </div>

      <div className="flex min-w-48 flex-1 flex-col gap-1.5">
        <label htmlFor={`desc-${zone?.id ?? "new"}`} className="text-text-3 text-xs font-semibold">
          Description
        </label>
        <input
          id={`desc-${zone?.id ?? "new"}`}
          name="description"
          defaultValue={zone?.description ?? ""}
          maxLength={500}
          className={`${champ} w-full`}
        />
      </div>

      <Bouton ton="principal" icone={zone ? Save : Plus} type="submit" disabled={pending}>
        {zone ? "Enregistrer" : "Ajouter"}
      </Bouton>

      {zone && (
        <Bouton ton="danger" icone={Trash2} type="button" onClick={supprimer} disabled={enCours}>
          Supprimer
        </Bouton>
      )}

      {zone && (
        <p className="text-text-3 basis-full text-xs">
          {zone.checkpoints} point(s) de contrôle · {zone.categories} catégorie(s) ·{" "}
          {zone.overrides} exception(s)
        </p>
      )}

      {(state.error || suppression) && (
        <p className="text-danger-text basis-full text-sm">{state.error ?? suppression}</p>
      )}
    </form>
  );
}
