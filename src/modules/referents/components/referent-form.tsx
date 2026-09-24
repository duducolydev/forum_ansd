"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import type { ActionState } from "../actions";
import type { ReferentInput } from "../schema";

interface Props {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues?: Partial<ReferentInput>;
  submitLabel: string;
}

const initialState: ActionState = {};

const CHAMP = "border-border bg-surface text-text rounded-lg border px-3 py-2.5";

/**
 * Fiche d'un référent interne (§28).
 *
 * L'adresse e-mail porte la mention de ce qu'elle déclenche : c'est elle qui
 * reçoit les alertes, et c'est aussi elle que les participants de la délégation
 * verront. Une adresse de service partagée est donc un choix légitime, à
 * condition d'être délibéré — d'où la précision sous le champ.
 */
export function ReferentForm({ action, defaultValues, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const d = defaultValues ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-heading text-sm font-semibold">
          Nom et prénom
        </label>
        <input id="name" name="name" required defaultValue={d.name} className={CHAMP} />
      </div>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-heading text-sm font-semibold">
            Adresse e-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            defaultValue={d.email}
            className={CHAMP}
          />
          <span className="text-text-3 text-xs">
            Reçoit les alertes, et sera communiquée aux participants de la délégation.
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="phone" className="text-heading text-sm font-semibold">
            Téléphone
          </label>
          <input id="phone" name="phone" defaultValue={d.phone} className={CHAMP} />
          <span className="text-text-3 text-xs">
            Communiqué aux participants. Laisser vide si le référent ne le souhaite pas.
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="role" className="text-heading text-sm font-semibold">
          Fonction
        </label>
        <input
          id="role"
          name="role"
          defaultValue={d.role}
          placeholder="Protocole, Logistique, Accueil…"
          className={CHAMP}
        />
      </div>

      <label className="text-text flex items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={d.isActive ?? true}
          className="size-4"
        />
        Référent en service
        <span className="text-text-3 text-xs">
          Décoché, il n&apos;est plus proposé au rattachement et ne reçoit plus d&apos;alerte.
        </span>
      </label>

      {state.error && <p className="text-danger-text text-sm">{state.error}</p>}

      <div>
        <Bouton ton="principal" icone={Save} type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : submitLabel}
        </Bouton>
      </div>
    </form>
  );
}
