"use client";
import { Save } from "lucide-react";
import { BoutonSite } from "@/components/site/bouton-site";

import { useActionState } from "react";
import { useLocale } from "next-intl";
import { lireLangue, selon } from "@/lib/langue";
import { CIVILITES } from "../registration-i18n";
import { updateMyInfoAction, type MySpaceState } from "../my-space-actions";
import { ChampTelephone } from "@/components/ui/champ-telephone";

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
  const langue = lireLangue(useLocale());
  const t = (textes: { fr: string; en: string; pt: string }) => selon(langue, textes);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="text-text-3 text-sm">
        {editable
          ? t({
              fr: `Vos informations restent modifiables jusqu'au ${deadlineLabel} (J-3).`,
              en: `Your details can be edited until ${deadlineLabel} (3 days before the Forum).`,
              pt: `Os seus dados podem ser alterados até ${deadlineLabel} (3 dias antes do Fórum).`,
            })
          : t({
              fr: `La période de modification en ligne est close depuis le ${deadlineLabel} (J-3). Adressez-vous à l'accueil du Forum.`,
              en: `Online editing closed on ${deadlineLabel} (3 days before the Forum). Please go to the Forum reception desk.`,
              pt: `O período de alteração em linha terminou a ${deadlineLabel} (3 dias antes do Fórum). Dirija-se à receção do Fórum.`,
            })}
      </p>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        {/*
          Mêmes civilités qu'à l'inscription : avec « Madame » et « Monsieur »
          seuls, un « Dr » choisi à l'inscription s'affichait vide et était
          effacé au premier enregistrement.
        */}
        <Select
          label={t({ fr: "Civilité", en: "Title", pt: "Tratamento" })}
          name="civility"
          value={values.civility}
          options={CIVILITES.map((option) => ({ value: option.value, label: t(option) }))}
          disabled={!editable}
        />
        <Field
          label={t({ fr: "Adresse e-mail", en: "Email address", pt: "Endereço de e-mail" })}
          name="emailReadOnly"
          value={email}
          disabled
          readOnly
        />
        <Field
          label={t({ fr: "Prénom", en: "First name", pt: "Nome próprio" })}
          name="firstName"
          value={values.firstName}
          disabled={!editable}
          required
        />
        <Field
          label={t({ fr: "Nom", en: "Last name", pt: "Apelido" })}
          name="lastName"
          value={values.lastName}
          disabled={!editable}
          required
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="phone" className="text-heading text-sm font-semibold">
            {t({ fr: "Téléphone", en: "Phone", pt: "Telefone" })}
          </label>
          <ChampTelephone
            id="phone"
            name="phone"
            langue={langue}
            classeChamp="border-border bg-surface text-text rounded-lg border px-3 py-2.5 disabled:opacity-60"
            defaultValue={values.phone}
            disabled={!editable}
          />
        </div>
        <Field
          label={t({ fr: "Ville", en: "City", pt: "Cidade" })}
          name="city"
          value={values.city}
          disabled={!editable}
        />
        <Field
          label={t({ fr: "Organisation", en: "Organisation", pt: "Organização" })}
          name="organization"
          value={values.organization}
          disabled={!editable}
        />
        <Field
          label={t({ fr: "Fonction", en: "Position", pt: "Cargo" })}
          name="jobTitle"
          value={values.jobTitle}
          disabled={!editable}
        />
        <Field
          label={t({
            fr: "Régime alimentaire",
            en: "Dietary requirements",
            pt: "Regime alimentar",
          })}
          name="dietaryRequirements"
          value={values.dietaryRequirements}
          disabled={!editable}
        />
        <Field
          label={t({
            fr: "Besoins particuliers",
            en: "Special needs",
            pt: "Necessidades especiais",
          })}
          name="specialNeeds"
          value={values.specialNeeds}
          disabled={!editable}
        />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-accent-text text-sm">{state.success}</p>}

      {editable && (
        <BoutonSite type="submit" ton="principal" disabled={pending} icone={Save} className="w-fit">
          {pending
            ? t({ fr: "Enregistrement…", en: "Saving…", pt: "A guardar…" })
            : t({
                fr: "Enregistrer mes informations",
                en: "Save my details",
                pt: "Guardar os meus dados",
              })}
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
  options: { value: string; label: string }[];
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
        <option value="">—</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
