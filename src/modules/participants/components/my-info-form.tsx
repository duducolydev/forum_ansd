"use client";
import { Save } from "lucide-react";
import { BoutonSite } from "@/components/site/bouton-site";

import { useActionState, type ReactNode } from "react";
import { useLocale } from "next-intl";
import { lireLangue, selon } from "@/lib/langue";
import { CIVILITES, TYPES_ORGANISATION } from "../registration-i18n";
import type { JourForum } from "../jours-forum";
import { updateMyInfoAction, type MySpaceState } from "../my-space-actions";
import { ChampTelephone } from "@/components/ui/champ-telephone";
import { ChampBiographie } from "@/components/ui/champ-biographie";
import { ChampPays } from "@/components/ui/champ-pays";

const initialState: MySpaceState = {};
const CHAMP =
  "border-border bg-surface text-text rounded-lg border px-3 py-2.5 disabled:opacity-60";

export interface MyInfoValues {
  civility: string;
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  city: string;
  organization: string;
  organizationType: string;
  jobTitle: string;
  activityDomain: string;
  website: string;
  bio: string;
  /** Journées retenues (dates ISO) ; vide quand l'inscription n'en a pas enregistré. */
  participationDays: string[];
  attendsOpening: boolean;
  attendsClosing: boolean;
  attendsAwards: boolean;
  /** `AAAA-MM-JJ`, ou vide. */
  arrivalDate: string;
  departureDate: string;
  needsAccommodation: boolean;
  needsTransport: boolean;
  dietaryRequirements: string;
  specialNeeds: string;
}

interface Props {
  values: MyInfoValues;
  email: string;
  editable: boolean;
  deadlineLabel: string;
  /** Journées du Forum, comme à l'inscription (`joursDuForum`). */
  days: JourForum[];
}

/**
 * « Mes informations » : tout ce que le participant a saisi à l'inscription,
 * regroupé comme les étapes du formulaire d'inscription (5 novembre 2026).
 * Restent hors de portée la catégorie, le statut, l'adresse e-mail (sa clé de
 * connexion) et les consentements, qui relèvent du comité.
 */
export function MyInfoForm({ values, email, editable, deadlineLabel, days }: Props) {
  const [state, formAction, pending] = useActionState(updateMyInfoAction, initialState);
  const langue = lireLangue(useLocale());
  const t = (textes: { fr: string; en: string; pt: string }) => selon(langue, textes);
  // Sans journées enregistrées (inscription ancienne ou saisie au comptoir),
  // toutes sont cochées, comme à l'inscription.
  const joursCoches = values.participationDays.length
    ? values.participationDays
    : days.map((day) => day.value);

  return (
    <form action={formAction} className="flex flex-col gap-5">
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

      <Groupe titre={t({ fr: "Identité", en: "Identity", pt: "Identidade" })}>
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
            classeChamp={CHAMP}
            defaultValue={values.phone}
            disabled={!editable}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="country" className="text-heading text-sm font-semibold">
            {t({ fr: "Pays", en: "Country", pt: "País" })}
          </label>
          <ChampPays
            id="country"
            defaultValue={values.country}
            langue={langue}
            disabled={!editable}
            required
          />
        </div>
        <Field
          label={t({ fr: "Ville", en: "City", pt: "Cidade" })}
          name="city"
          value={values.city}
          disabled={!editable}
        />
      </Groupe>

      <Groupe
        titre={t({
          fr: "Profil professionnel",
          en: "Professional profile",
          pt: "Perfil profissional",
        })}
      >
        <Field
          label={t({ fr: "Organisation", en: "Organisation", pt: "Organização" })}
          name="organization"
          value={values.organization}
          disabled={!editable}
        />
        <Select
          label={t({
            fr: "Type d'organisation",
            en: "Type of organisation",
            pt: "Tipo de organização",
          })}
          name="organizationType"
          value={values.organizationType}
          options={optionsAvecValeur(
            TYPES_ORGANISATION.map((option) => ({ value: option.value, label: t(option) })),
            values.organizationType,
          )}
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
            fr: "Domaine d'activité",
            en: "Field of activity",
            pt: "Área de atividade",
          })}
          name="activityDomain"
          value={values.activityDomain}
          disabled={!editable}
        />
        <Field
          label={t({ fr: "Site Internet", en: "Website", pt: "Sítio Web" })}
          name="website"
          value={values.website}
          disabled={!editable}
        />
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label htmlFor="bio" className="text-heading text-sm font-semibold">
            {t({ fr: "Biographie", en: "Biography", pt: "Biografia" })}
          </label>
          {/* La même que sur la fiche intervenant, s'il en a une (`speakers/biographie.ts`). */}
          <span id="bio-aide" className="text-text-3 text-xs">
            {t({
              fr: "Si vous intervenez au Forum, c'est aussi la biographie publiée sur votre fiche d'intervenant. 600 mots au plus.",
              en: "If you are a speaker at the Forum, this is also the biography published on your speaker profile. 600 words at most.",
              pt: "Se for orador no Fórum, é também a biografia publicada na sua ficha de orador. 600 palavras no máximo.",
            })}
          </span>
          <ChampBiographie
            id="bio"
            name="bio"
            defaultValue={values.bio}
            disabled={!editable}
            langue={langue}
            describedBy="bio-aide"
            className={CHAMP}
          />
        </div>
      </Groupe>

      <Groupe titre={t({ fr: "Participation", en: "Attendance", pt: "Participação" })}>
        <fieldset className="flex flex-col gap-2 md:col-span-2" disabled={!editable}>
          <legend className="text-heading mb-1.5 text-sm font-semibold">
            {t({
              fr: "Jours de participation",
              en: "Days of attendance",
              pt: "Dias de participação",
            })}
          </legend>
          <div className="flex flex-wrap gap-2.5">
            {days.map((day) => (
              <Checkbox
                key={day.value}
                label={day.label}
                name="participationDays"
                value={day.value}
                defaultChecked={joursCoches.includes(day.value)}
              />
            ))}
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-2 md:col-span-2" disabled={!editable}>
          <legend className="text-heading mb-1.5 text-sm font-semibold">
            {t({ fr: "Moments officiels", en: "Official events", pt: "Momentos oficiais" })}
          </legend>
          <div className="flex flex-wrap gap-2.5">
            <Checkbox
              label={t({
                fr: "Cérémonie d'ouverture",
                en: "Opening ceremony",
                pt: "Cerimónia de abertura",
              })}
              name="attendsOpening"
              defaultChecked={values.attendsOpening}
            />
            <Checkbox
              label={t({
                fr: "Cérémonie de distinction",
                en: "Awards ceremony",
                pt: "Cerimónia de distinção",
              })}
              name="attendsAwards"
              defaultChecked={values.attendsAwards}
            />
            <Checkbox
              label={t({
                fr: "Cérémonie de clôture",
                en: "Closing ceremony",
                pt: "Cerimónia de encerramento",
              })}
              name="attendsClosing"
              defaultChecked={values.attendsClosing}
            />
          </div>
        </fieldset>
      </Groupe>

      <Groupe titre={t({ fr: "Logistique", en: "Logistics", pt: "Logística" })}>
        <Field
          label={t({
            fr: "Date d'arrivée (participants internationaux uniquement)",
            en: "Arrival date (international participants only)",
            pt: "Data de chegada (apenas participantes internacionais)",
          })}
          name="arrivalDate"
          type="date"
          value={values.arrivalDate}
          disabled={!editable}
        />
        <Field
          label={t({
            fr: "Date de départ (participants internationaux uniquement)",
            en: "Departure date (international participants only)",
            pt: "Data de partida (apenas participantes internacionais)",
          })}
          name="departureDate"
          type="date"
          value={values.departureDate}
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
        <fieldset className="flex flex-wrap gap-2.5 md:col-span-2" disabled={!editable}>
          <Checkbox
            label={t({
              fr: "J'ai besoin d'un hébergement",
              en: "I need accommodation",
              pt: "Preciso de alojamento",
            })}
            name="needsAccommodation"
            defaultChecked={values.needsAccommodation}
          />
          <Checkbox
            label={t({
              fr: "J'ai besoin d'un transport",
              en: "I need transport",
              pt: "Preciso de transporte",
            })}
            name="needsTransport"
            defaultChecked={values.needsTransport}
          />
        </fieldset>
      </Groupe>

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

/** Groupe de champs, titré comme l'étape correspondante de l'inscription. */
function Groupe({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className="border-border flex flex-col gap-3 border-t pt-4">
      <h3 className="text-text-3 text-xs font-semibold tracking-wide uppercase">{titre}</h3>
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  name,
  value,
  disabled,
  readOnly,
  required,
  type = "text",
}: {
  label: string;
  name: string;
  value: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  type?: "text" | "date";
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
        defaultValue={value}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        className={CHAMP}
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
      <select id={name} name={name} defaultValue={value} disabled={disabled} className={CHAMP}>
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

function Checkbox({
  label,
  name,
  value,
  defaultChecked,
}: {
  label: string;
  name: string;
  value?: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="border-border bg-surface flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="accent-primary"
      />
      {label}
    </label>
  );
}

/**
 * Garde une valeur enregistrée absente de la liste (type d'organisation
 * importé, ou saisi avant un changement de liste) : sans elle, le menu
 * l'afficherait vide et le premier enregistrement l'effacerait.
 */
function optionsAvecValeur(
  options: { value: string; label: string }[],
  valeur: string,
): { value: string; label: string }[] {
  return valeur && !options.some((option) => option.value === valeur)
    ? [...options, { value: valeur, label: valeur }]
    : options;
}
