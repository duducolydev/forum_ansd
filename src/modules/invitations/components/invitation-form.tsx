"use client";

import { useActionState } from "react";
import { createInvitationAction, type ActionState } from "../actions";
import type { InvitationInput } from "../schema";
import { MailPlus, Save } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { BoutonEnvoiConfirme } from "@/components/ui/bouton-confirme";

const initialState: ActionState = {};

interface Props {
  categories: { id: string; labelFr: string }[];
  /** Absent : création. Présent : correction d'une invitation existante. */
  action?: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues?: Partial<InvitationInput>;
  /** L'invitation est déjà partie : changer l'adresse invalidera le lien envoyé. */
  dejaEnvoyee?: boolean;
}

/** L'adresse a été modifiée depuis l'ouverture de la fiche. */
function adresseModifiee(formulaire: HTMLFormElement): boolean {
  const champ = formulaire.elements.namedItem("email");
  // Même normalisation que le schéma : une majuscule ajoutée ne change pas l'adresse.
  return (
    champ instanceof HTMLInputElement &&
    champ.value.trim().toLowerCase() !== champ.defaultValue.toLowerCase()
  );
}

export function InvitationForm({ categories, action, defaultValues, dejaEnvoyee }: Props) {
  const [state, formAction, pending] = useActionState(
    action ?? createInvitationAction,
    initialState,
  );
  const d = defaultValues ?? {};
  const modification = Boolean(action);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
      <Field label="Prénom" name="firstName" required defaultValue={d.firstName} />
      <Field label="Nom" name="lastName" required defaultValue={d.lastName} />
      <Field label="E-mail" name="email" type="email" required defaultValue={d.email} />
      <Field label="Organisation" name="organization" defaultValue={d.organization} />
      <Field label="Pays" name="country" defaultValue={d.country} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="categoryId" className="text-heading text-sm font-semibold">
          Catégorie
        </label>
        <select
          id="categoryId"
          name="categoryId"
          required
          defaultValue={d.categoryId ?? ""}
          className="border-border bg-surface text-text rounded-lg border px-3 py-2.5"
        >
          <option value="" disabled>
            Choisir…
          </option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.labelFr}
            </option>
          ))}
        </select>
      </div>

      {state.error && <p className="text-danger-text text-sm md:col-span-2">{state.error}</p>}

      <div className="md:col-span-2">
        {modification ? (
          <BoutonEnvoiConfirme
            ton="principal"
            icone={Save}
            siNecessaire={(formulaire) => Boolean(dejaEnvoyee) && adresseModifiee(formulaire)}
            confirmation={{
              titre: "Changer l'adresse de cette invitation ?",
              texte:
                "Le lien déjà envoyé ne fonctionnera plus. L'invitation repasse « À envoyer » : il faudra l'envoyer à la nouvelle adresse.",
              confirmer: "Changer l'adresse",
            }}
            disabled={pending}
          >
            {pending ? "Enregistrement…" : "Enregistrer"}
          </BoutonEnvoiConfirme>
        ) : (
          <Bouton ton="principal" icone={MailPlus} type="submit" disabled={pending}>
            {pending ? "Création…" : "Créer l'invitation"}
          </Bouton>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-heading text-sm font-semibold">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="border-border bg-surface text-text rounded-lg border px-3 py-2.5"
      />
    </div>
  );
}
