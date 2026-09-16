"use client";
import { ArrowLeft, ArrowRight, Send } from "lucide-react";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  REGISTRATION_STEPS,
  registrationConsentSchema,
  registrationIdentitySchema,
  registrationParticipationSchema,
  registrationProfessionSchema,
} from "../registration-schema";
import { submitRegistrationAction, type RegistrationState } from "../registration-actions";
import { PhotoField } from "./photo-field";

const DRAFT_KEY = "forum-ansd:registration-draft";
const initialState: RegistrationState = {};

export interface RegistrationCategory {
  id: string;
  labelFr: string;
  requiresLogistics: boolean;
}

export interface RegistrationDay {
  value: string;
  label: string;
}

interface Props {
  categories: RegistrationCategory[];
  days: RegistrationDay[];
  invitation?: {
    token: string;
    firstName: string;
    lastName: string;
    email: string;
    categoryId: string;
  } | null;
}

export function RegistrationForm({ categories, days, invitation }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState(invitation?.categoryId ?? "");

  /*
   * Consentements **contrôlés**, contrairement aux autres champs : ce sont des
   * engagements juridiques, ils méritent d'être tenus par l'état du composant
   * plutôt que par l'état du DOM. C'est cet état qui est envoyé au serveur
   * (cf. `handleSubmit`).
   */
  const [consents, setConsents] = useState({
    consentTerms: false,
    consentData: false,
    consentImage: false,
  });

  /** Photo de badge, déjà recadrée en carré par `PhotoField`. */
  const [photo, setPhoto] = useState<File | null>(null);

  const [state, formAction, pending] = useActionState(submitRegistrationAction, initialState);

  const selectedCategory = categories.find((category) => category.id === categoryId);
  const needsLogistics = selectedCategory?.requiresLogistics ?? false;

  const steps = REGISTRATION_STEPS.filter((step) => step.key !== "logistics" || needsLogistics);
  const currentStep = steps[stepIndex];

  // Brouillon local : restauration au montage, sauvegarde à chaque changement d'étape.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw || !formRef.current) return;
      const draft = JSON.parse(raw) as Record<string, string | string[] | boolean>;
      for (const [name, value] of Object.entries(draft)) {
        const field = formRef.current.elements.namedItem(name);
        if (!field) continue;
        if (field instanceof HTMLInputElement && field.type === "checkbox") {
          field.checked = Boolean(value);
        } else if (
          field instanceof HTMLInputElement ||
          field instanceof HTMLSelectElement ||
          field instanceof HTMLTextAreaElement
        ) {
          field.value = String(value);
          if (field.name === "categoryId") setCategoryId(String(value));
        }
      }
    } catch {
      // Brouillon illisible : on repart d'un formulaire vierge, sans bloquer l'utilisateur.
    }
  }, []);

  function saveDraft() {
    if (!formRef.current) return;
    try {
      const data = new FormData(formRef.current);
      const draft: Record<string, unknown> = {};
      for (const [key, value] of data.entries()) {
        if (key === "captchaToken" || key === "fax") continue;
        draft[key] = value instanceof File ? undefined : value;
      }
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // localStorage indisponible (navigation privée) : le formulaire reste utilisable.
    }
  }

  function validateCurrentStep(): string | null {
    if (!formRef.current) return null;
    const data = new FormData(formRef.current);
    const value = (name: string) => String(data.get(name) ?? "");

    switch (currentStep.key) {
      case "identity": {
        const result = registrationIdentitySchema.safeParse({
          civility: value("civility"),
          firstName: value("firstName"),
          lastName: value("lastName"),
          email: value("email"),
          phone: value("phone"),
          country: value("country"),
          city: value("city"),
          locale: value("locale") || "fr",
          categoryId: value("categoryId"),
        });
        return result.success ? null : (result.error.issues[0]?.message ?? "Étape incomplète");
      }
      case "profession": {
        const result = registrationProfessionSchema.safeParse({
          organization: value("organization"),
          organizationType: value("organizationType"),
          jobTitle: value("jobTitle"),
          activityDomain: value("activityDomain"),
          bio: value("bio"),
          website: value("website"),
        });
        return result.success ? null : (result.error.issues[0]?.message ?? "Étape incomplète");
      }
      case "participation": {
        const result = registrationParticipationSchema.safeParse({
          participationDays: data.getAll("participationDays").map(String),
          attendsOpening: data.get("attendsOpening") === "on",
          attendsInaugural: data.get("attendsInaugural") === "on",
          attendsAwards: data.get("attendsAwards") === "on",
        });
        return result.success ? null : (result.error.issues[0]?.message ?? "Étape incomplète");
      }
      case "consent": {
        const result = registrationConsentSchema.safeParse({
          consentTerms: data.get("consentTerms") === "on",
          consentData: data.get("consentData") === "on",
          consentImage: data.get("consentImage") === "on",
        });
        return result.success ? null : (result.error.issues[0]?.message ?? "Étape incomplète");
      }
      default:
        return null;
    }
  }

  /**
   * Envoi du formulaire.
   *
   * Le `FormData` est **construit ici, à partir du DOM vivant**, puis passé à
   * l'action ; le formulaire ne porte donc pas `action={formAction}`.
   *
   * Motif : la sérialisation automatique de React envoyait des valeurs
   * périmées. Mesuré sur ce formulaire — champs cachés valant `on` dans le
   * DOM, `_1_consentTerms=off` dans la requête : l'inscription était refusée
   * pour consentement manquant alors que l'utilisateur avait bien coché, et
   * aucune inscription ne pouvait aboutir.
   *
   * Les consentements sont en outre réécrits depuis l'état React, qui fait
   * autorité pour ces trois valeurs.
   */
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formRef.current) return;

    const data = new FormData(formRef.current);
    data.set("consentTerms", consents.consentTerms ? "on" : "off");
    data.set("consentData", consents.consentData ? "on" : "off");
    data.set("consentImage", consents.consentImage ? "on" : "off");
    if (photo) data.set("photo", photo);

    startTransition(() => formAction(data));
  }

  function goNext() {
    const error = validateCurrentStep();
    setStepError(error);
    if (error) return;
    saveDraft();
    setStepIndex((index) => Math.min(steps.length - 1, index + 1));
  }

  function goPrevious() {
    setStepError(null);
    setStepIndex((index) => Math.max(0, index - 1));
  }

  if (state.success) {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // sans conséquence
    }
    return (
      <div className="border-accent-text bg-accent-soft text-accent-text rounded-xl border p-6">
        <h2 className="mb-2 text-xl">Inscription enregistrée</h2>
        <p>
          {state.success.autoConfirmed
            ? "Votre participation est confirmée. Vous allez recevoir un e-mail avec l'accès à votre espace."
            : "Votre inscription est enregistrée et en attente de validation par le comité d'organisation. Vous recevrez un e-mail dès qu'elle sera confirmée."}
        </p>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-6">
      <input type="hidden" name="invitationToken" value={invitation?.token ?? ""} />
      <input type="hidden" name="locale" value="fr" />
      {/* Honeypot : masqué aux utilisateurs, rempli par les robots. */}
      <input
        type="text"
        name="fax"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />

      <div>
        <div className="mb-2.5 flex gap-1.5">
          {steps.map((step, index) => (
            <div
              key={step.key}
              className={`h-1.5 flex-1 rounded-sm ${
                index < stepIndex
                  ? "bg-ansd-vert-vif"
                  : index === stepIndex
                    ? "bg-ansd-bleu-vif"
                    : "bg-bg-3"
              }`}
            />
          ))}
        </div>
        <div className="text-text-3 flex justify-between text-sm">
          <span>
            Étape <b className="text-heading">{stepIndex + 1}</b> sur {steps.length}
          </span>
          <b className="text-heading">{currentStep.label}</b>
        </div>
      </div>

      <div hidden={currentStep.key !== "identity"}>
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <Select label="Civilité" name="civility" options={["", "Madame", "Monsieur"]} />
          <div />
          <Field label="Prénom" name="firstName" defaultValue={invitation?.firstName} required />
          <Field label="Nom" name="lastName" defaultValue={invitation?.lastName} required />
          <Field
            label="Adresse e-mail"
            name="email"
            type="email"
            defaultValue={invitation?.email}
            readOnly={Boolean(invitation)}
            required
          />
          <Field label="Téléphone" name="phone" />
          <Field label="Pays" name="country" required />
          <Field label="Ville" name="city" />
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label htmlFor="categoryId" className="text-heading text-sm font-semibold">
              Catégorie de participation
            </label>
            <select
              id="categoryId"
              name="categoryId"
              required
              value={categoryId}
              disabled={Boolean(invitation)}
              onChange={(event) => setCategoryId(event.target.value)}
              className="border-border bg-surface text-text rounded-lg border px-3 py-2.5 disabled:opacity-70"
            >
              <option value="">Choisir…</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.labelFr}
                </option>
              ))}
            </select>
            {invitation && (
              <p className="text-text-3 text-xs">Catégorie définie par votre invitation.</p>
            )}
          </div>
        </div>
      </div>

      <div hidden={currentStep.key !== "profession"}>
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <Field label="Organisation" name="organization" />
          <Select
            label="Type d'organisation"
            name="organizationType"
            options={[
              "",
              "Institut national de statistique",
              "Organisation internationale",
              "Administration publique",
              "Université / recherche",
              "Secteur privé",
              "Média",
            ]}
          />
          <Field label="Fonction" name="jobTitle" />
          <Field label="Domaine d'activité" name="activityDomain" />
          <Field label="Site Internet" name="website" />
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label htmlFor="bio" className="text-heading text-sm font-semibold">
              Biographie courte
            </label>
            <textarea
              id="bio"
              name="bio"
              rows={3}
              maxLength={300}
              placeholder="300 caractères maximum"
              className="border-border bg-surface text-text rounded-lg border px-3 py-2.5"
            />
          </div>
        </div>
      </div>

      <div hidden={currentStep.key !== "profession"} className="mt-6">
        <PhotoField
          onChange={setPhoto}
          label="Photo (facultative)"
          hint="Elle figurera sur votre badge et facilitera le contrôle à l'entrée. Vous pourrez l'ajouter plus tard depuis « Mes inscriptions »."
        />
      </div>

      <div hidden={currentStep.key !== "participation"}>
        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-heading mb-1.5 text-sm font-semibold">
              Jours de participation
            </legend>
            <div className="flex flex-wrap gap-2.5">
              {days.map((day) => (
                <label
                  key={day.value}
                  className="border-border bg-surface flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm"
                >
                  <input
                    type="checkbox"
                    name="participationDays"
                    value={day.value}
                    defaultChecked
                    className="accent-primary"
                  />
                  {day.label}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-heading mb-1.5 text-sm font-semibold">Moments officiels</legend>
            <div className="flex flex-wrap gap-2.5">
              <Checkbox label="Cérémonie d'ouverture" name="attendsOpening" defaultChecked />
              <Checkbox label="Conférence inaugurale" name="attendsInaugural" defaultChecked />
              <Checkbox label="Cérémonie de distinction" name="attendsAwards" />
            </div>
          </fieldset>
        </div>
      </div>

      <div hidden={currentStep.key !== "logistics"}>
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <Field label="Date d'arrivée" name="arrivalDate" type="date" />
          <Field label="Date de départ" name="departureDate" type="date" />
          <Field label="Régime alimentaire" name="dietaryRequirements" />
          <Field label="Besoins particuliers" name="specialNeeds" />
          <div className="flex flex-wrap gap-2.5 md:col-span-2">
            <Checkbox label="J'ai besoin d'un hébergement" name="needsAccommodation" />
            <Checkbox label="J'ai besoin d'un transport" name="needsTransport" />
          </div>
        </div>
      </div>

      <div hidden={currentStep.key !== "consent"}>
        <div className="flex flex-col gap-2.5">
          <ConsentCheckbox
            label="J'accepte les conditions de participation au Forum."
            name="consentTerms"
            checked={consents.consentTerms}
            onChange={(value) => setConsents((c) => ({ ...c, consentTerms: value }))}
          />
          <ConsentCheckbox
            label="Je consens au traitement de mes données personnelles pour l'organisation du Forum (loi n° 2008-12)."
            name="consentData"
            checked={consents.consentData}
            onChange={(value) => setConsents((c) => ({ ...c, consentData: value }))}
          />
          <ConsentCheckbox
            label="J'autorise la prise et l'utilisation de mon image dans les supports du Forum."
            name="consentImage"
            checked={consents.consentImage}
            onChange={(value) => setConsents((c) => ({ ...c, consentImage: value }))}
          />
        </div>
      </div>

      {stepError && <p className="text-danger-text text-sm">{stepError}</p>}
      {/*
        L'erreur renvoyée par le serveur n'est montrée que sur la dernière
        étape : revenir en arrière après un envoi refusé l'affichait au milieu
        d'une étape sans rapport, où elle passait pour un blocage de cette
        étape-là.
      */}
      {state.error && currentStep.key === "consent" && (
        <p className="text-danger-text text-sm">{state.error}</p>
      )}
      {state.duplicateEmail && (
        <p className="border-warn-text bg-warn-soft text-warn-text rounded-lg border p-3.5 text-sm">
          Cette adresse e-mail est déjà inscrite. Utilisez{" "}
          <Link href="/mon-espace" className="font-semibold underline">
            « Mes inscriptions »
          </Link>{" "}
          pour recevoir un lien d&apos;accès plutôt que de vous inscrire une seconde fois.
        </p>
      )}

      <div className="border-border flex justify-between border-t pt-5">
        <button
          type="button"
          onClick={goPrevious}
          disabled={stepIndex === 0}
          className="border-border bg-surface text-heading hover:border-link transition-tout inline-flex items-center gap-2 rounded-lg border px-4.5 py-2.5 font-semibold disabled:opacity-50"
        >
          <ArrowLeft aria-hidden size={16} strokeWidth={2.2} />
          Précédent
        </button>
        {stepIndex < steps.length - 1 ? (
          <button
            type="button"
            onClick={goNext}
            className="bg-primary text-primary-text hover:bg-primary-hover transition-tout inline-flex items-center gap-2 rounded-lg px-4.5 py-2.5 font-semibold shadow-sm hover:shadow-lg"
          >
            Continuer
            <ArrowRight aria-hidden size={16} strokeWidth={2.2} />
          </button>
        ) : (
          <button
            type="submit"
            disabled={pending}
            className="bg-primary text-primary-text hover:bg-primary-hover transition-tout inline-flex items-center gap-2 rounded-lg px-4.5 py-2.5 font-semibold shadow-sm hover:shadow-lg disabled:opacity-60"
          >
            <Send aria-hidden size={16} strokeWidth={2.2} />
            {pending ? "Envoi…" : "Envoyer mon inscription"}
          </button>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  readOnly,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  readOnly?: boolean;
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
        defaultValue={defaultValue}
        required={required}
        readOnly={readOnly}
        className="border-border bg-surface text-text rounded-lg border px-3 py-2.5 read-only:opacity-70"
      />
    </div>
  );
}

function Select({ label, name, options }: { label: string; name: string; options: string[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-heading text-sm font-semibold">
        {label}
      </label>
      <select
        id={name}
        name={name}
        className="border-border bg-surface text-text rounded-lg border px-3 py-2.5"
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

/**
 * Case de consentement : l'affichage est contrôlé par React, et la valeur
 * soumise voyage dans un champ **caché** portant le `name`.
 *
 * La case visible n'a volontairement pas de `name` : si elle en avait un, sa
 * valeur — vulnérable au `reset()` de React — serait celle envoyée au serveur.
 */
function ConsentCheckbox({
  label,
  name,
  checked,
  onChange,
}: {
  label: string;
  name: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  /*
   * Le `<label>` est associé par `htmlFor` et **n'enveloppe pas** la case :
   * structure recommandée, et une source d'ambiguïté de moins entre
   * l'activation du libellé et celle de la case.
   */
  return (
    <div className="border-border bg-surface flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm">
      <input
        id={name}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-primary"
      />
      <label htmlFor={name} className="flex-1 cursor-pointer">
        {label}
      </label>
    </div>
  );
}

function Checkbox({
  label,
  name,
  defaultChecked,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
}) {
  // Même structure que les consentements : libellé associé par `htmlFor`, jamais
  // imbriqué autour de la case (cf. ConsentCheckbox).
  return (
    <div className="border-border bg-surface flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm">
      <input
        id={name}
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="accent-primary"
      />
      <label htmlFor={name} className="flex-1 cursor-pointer">
        {label}
      </label>
    </div>
  );
}
