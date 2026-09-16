"use client";
import { Save } from "lucide-react";
import { BoutonSite } from "@/components/site/bouton-site";

import { useActionState } from "react";
import { updateMyInfoAction, type MySpaceState } from "../my-space-actions";

const initialState: MySpaceState = {};

export interface MyInfoValues {
  civility: string;
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  organization: string;
  jobTitle: string;
  dietaryRequirements: string;
  specialNeeds: string;
}

interface Props {
  values: MyInfoValues;
  email: string;
  editable: boolean;
  deadlineLabel: string;
}

export function MyInfoForm({ values, email, editable, deadlineLabel }: Props) {
  const [state, formAction, pending] = useActionState(updateMyInfoAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="text-text-3 text-sm">
        {editable
          ? `Vos informations restent modifiables jusqu'au ${deadlineLabel} (J-3).`
          : `La période de modification en ligne est close depuis le ${deadlineLabel} (J-3). Adressez-vous à l'accueil du Forum.`}
      </p>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <Select
          label="Civilité"
          name="civility"
          value={values.civility}
          options={["", "Madame", "Monsieur"]}
          disabled={!editable}
        />
        <Field label="Adresse e-mail" name="emailReadOnly" value={email} disabled readOnly />
        <Field
          label="Prénom"
          name="firstName"
          value={values.firstName}
          disabled={!editable}
          required
        />
        <Field label="Nom" name="lastName" value={values.lastName} disabled={!editable} required />
        <Field label="Téléphone" name="phone" value={values.phone} disabled={!editable} />
        <Field label="Ville" name="city" value={values.city} disabled={!editable} />
        <Field
          label="Organisation"
          name="organization"
          value={values.organization}
          disabled={!editable}
        />
        <Field label="Fonction" name="jobTitle" value={values.jobTitle} disabled={!editable} />
        <Field
          label="Régime alimentaire"
          name="dietaryRequirements"
          value={values.dietaryRequirements}
          disabled={!editable}
        />
        <Field
          label="Besoins particuliers"
          name="specialNeeds"
          value={values.specialNeeds}
          disabled={!editable}
        />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-accent-text text-sm">{state.success}</p>}

      {editable && (
        <BoutonSite type="submit" ton="principal" disabled={pending} icone={Save} className="w-fit">
          {pending ? "Enregistrement…" : "Enregistrer mes informations"}
        </BoutonSite>
      )}
    </form>
  );
}

function Field({
  label,
  name,
  value,
  disabled,
  readOnly,
  required,
}: {
  label: string;
  name: string;
  value: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-heading text-sm font-semibold">
        {label}
      </label>
      <input
        id={name}
        name={name}
        defaultValue={value}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        className="border-border bg-surface text-text rounded-lg border px-3 py-2.5 disabled:opacity-60"
      />
    </div>
  );
}

function Select({
  label,
  name,
  value,
  options,
  disabled,
}: {
  label: string;
  name: string;
  value: string;
  options: string[];
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-heading text-sm font-semibold">
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue={value}
        disabled={disabled}
        className="border-border bg-surface text-text rounded-lg border px-3 py-2.5 disabled:opacity-60"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option || "—"}
          </option>
        ))}
      </select>
    </div>
  );
}
