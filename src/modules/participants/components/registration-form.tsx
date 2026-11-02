"use client";
import { ArrowLeft, ArrowRight, Send } from "lucide-react";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { lireLangue, selon, traduire } from "@/lib/langue";
import {
  REGISTRATION_STEPS,
  registrationConsentSchema,
  registrationIdentitySchema,
  registrationParticipationSchema,
  registrationProfessionSchema,
} from "../registration-schema";
import { submitRegistrationAction, type RegistrationState } from "../registration-actions";
import {
  CIVILITES,
  LIBELLES_ETAPES,
  TYPES_ORGANISATION,
  traduireErreur,
} from "../registration-i18n";
import { PhotoField } from "./photo-field";
import { ChampTelephone } from "@/components/ui/champ-telephone";

const DRAFT_KEY = "forum-ansd:registration-draft";

/** L'état renvoyé par le serveur, plus un envoi qui n'a pas abouti. */
type EtatEnvoi = RegistrationState & { envoiInterrompu?: boolean };
const initialState: EtatEnvoi = {};

/**
 * Envoi qui ne fait jamais tomber la page (30 octobre 2026).
 *
 * L'action ne lève rien : ses refus reviennent comme des états. Mais la requête
 * peut échouer avant d'atteindre l'application, ou sa réponse être remplacée en
 * chemin (coupure réseau, page d'erreur d'un équipement intermédiaire). Next
 * lève alors « An unexpected response was received from the server », et
 * l'erreur remontait jusqu'à la page : « Application error », formulaire perdu,
 * photo et consentements compris. Constaté le 29 octobre 2026 au clic sur
 * « Envoyer », sur téléphone comme sur ordinateur.
 */
async function envoyerInscription(precedent: EtatEnvoi, donnees: FormData): Promise<EtatEnvoi> {
  try {
    return await submitRegistrationAction(precedent, donnees);
  } catch {
    return { envoiInterrompu: true };
  }
}

export interface RegistrationCategory {
  id: string;
  labelFr: string;
  labelEn?: string | null;
  labelPt?: string | null;
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
    /** Choisie par le comité ; pas forcément parmi les catégories publiques. */
    category: RegistrationCategory;
  } | null;
}

export function RegistrationForm({ categories, days, invitation }: Props) {
  const langue = lireLangue(useLocale());
  const t = (textes: { fr: string; en: string; pt: string }) => selon(langue, textes);
  const libelleCategorie = (category: RegistrationCategory) =>
    traduire(langue, { fr: category.labelFr, en: category.labelEn, pt: category.labelPt });
  const formRef = useRef<HTMLFormElement>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState(invitation?.category.id ?? "");

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

  const [state, formAction, pending] = useActionState(envoyerInscription, initialState);

  const selectedCategory =
    invitation?.category ?? categories.find((category) => category.id === categoryId);
  const needsLogistics = selectedCategory?.requiresLogistics ?? false;

  const steps = REGISTRATION_STEPS.filter((step) => step.key !== "logistics" || needsLogistics);
  const currentStep = steps[stepIndex];

  // Brouillon local : restauration au montage, sauvegarde à chaque changement d'étape.
  const invite = useRef(Boolean(invitation));
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw || !formRef.current) return;
      const draft = JSON.parse(raw) as Record<string, string | string[] | boolean>;
      for (const [name, value] of Object.entries(draft)) {
        // Adresse et catégorie d'une invitation sont fixées par le comité : un
        // brouillon laissé sur l'appareil ne doit pas les remplacer.
        if (invite.current && (name === "email" || name === "categoryId")) continue;
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
          organization: value("organization"),
          country: value("country"),
          city: value("city"),
          locale: value("locale") || "fr",
          categoryId: value("categoryId"),
        });
        return result.success
          ? null
          : traduireErreur(langue, result.error.issues[0]?.message ?? "Étape incomplète");
      }
      case "profession": {
        const result = registrationProfessionSchema.safeParse({
          organizationType: value("organizationType"),
          jobTitle: value("jobTitle"),
          activityDomain: value("activityDomain"),
          bio: value("bio"),
          website: value("website"),
        });
        return result.success
          ? null
          : traduireErreur(langue, result.error.issues[0]?.message ?? "Étape incomplète");
      }
      case "participation": {
        const result = registrationParticipationSchema.safeParse({
          participationDays: data.getAll("participationDays").map(String),
          attendsOpening: data.get("attendsOpening") === "on",
          attendsInaugural: data.get("attendsInaugural") === "on",
          attendsClosing: data.get("attendsClosing") === "on",
          attendsAwards: data.get("attendsAwards") === "on",
        });
        return result.success
          ? null
          : traduireErreur(langue, result.error.issues[0]?.message ?? "Étape incomplète");
      }
      case "consent": {
        const result = registrationConsentSchema.safeParse({
          consentTerms: data.get("consentTerms") === "on",
          consentData: data.get("consentData") === "on",
          consentImage: data.get("consentImage") === "on",
        });
        return result.success
          ? null
          : traduireErreur(langue, result.error.issues[0]?.message ?? "Étape incomplète");
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
   *
   * Sans la photo, après un envoi interrompu : c'est le seul contenu binaire de
   * la requête, et elle est facultative — elle s'ajoute ensuite depuis
   * « Mon espace ».
   */
  function envoyer(avecPhoto: boolean) {
    if (!formRef.current) return;

    const data = new FormData(formRef.current);
    data.set("consentTerms", consents.consentTerms ? "on" : "off");
    data.set("consentData", consents.consentData ? "on" : "off");
    data.set("consentImage", consents.consentImage ? "on" : "off");
    if (photo && avecPhoto) data.set("photo", photo);

    startTransition(() => formAction(data));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    envoyer(true);
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
        <h2 className="mb-2 text-xl">
          {t({
            fr: "Inscription enregistrée",
            en: "Registration recorded",
            pt: "Inscrição registada",
          })}
        </h2>
        <p>
          {state.success.autoConfirmed
            ? t({
                fr: "Votre participation est confirmée. Vous allez recevoir un e-mail avec un accès direct à votre espace.",
                en: "Your participation is confirmed. You will receive an email with direct access to your space.",
                pt: "A sua participação está confirmada. Vai receber um e-mail com acesso direto ao seu espaço.",
              })
            : state.success.accreditation
              ? t({
                  fr: "Votre demande d'accréditation presse est enregistrée. Votre compte sera activé dès que l'administration du Forum aura accordé votre accréditation ; vous recevrez alors un e-mail avec un accès direct à votre espace.",
                  en: "Your press accreditation request has been recorded. Your account will be activated as soon as the Forum administration grants your accreditation; you will then receive an email with direct access to your space.",
                  pt: "O seu pedido de acreditação de imprensa foi registado. A sua conta será ativada assim que a administração do Fórum conceder a sua acreditação; receberá então um e-mail com acesso direto ao seu espaço.",
                })
              : t({
                  fr: "Votre inscription est enregistrée et en attente de validation par le comité d'organisation. Votre badge sera disponible dans votre espace une fois l'inscription validée : vous recevrez un e-mail de confirmation avec un accès direct à votre espace, puis un second quand le badge sera prêt.",
                  en: "Your registration has been recorded and is awaiting validation by the organising committee. Your badge will be available in your space once your registration is validated: you will receive a confirmation email with direct access to your space, then a second one when your badge is ready.",
                  pt: "A sua inscrição foi registada e aguarda validação pela comissão organizadora. O seu crachá estará disponível no seu espaço assim que a inscrição for validada: receberá um e-mail de confirmação com acesso direto ao seu espaço e, depois, um segundo quando o crachá estiver pronto.",
                })}
        </p>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-6">
      <input type="hidden" name="invitationToken" value={invitation?.token ?? ""} />
      {/* Langue des e-mails : celle dans laquelle la personne remplit le formulaire. */}
      <input type="hidden" name="locale" value={langue} />
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
        {/*
          Indicateur d'étapes animé (brief « Constellation » §6) : chaque barre
          se remplit en glissant quand on l'atteint. La couleur n'est pas seule
          à parler : « Étape 2 sur 5 » et le nom de l'étape suivent.
        */}
        <div className="mb-2.5 flex gap-1.5">
          {steps.map((step, index) => (
            <div key={step.key} className="etape-barre">
              <span
                data-etat={
                  index < stepIndex ? "faite" : index === stepIndex ? "courante" : "a-venir"
                }
              />
            </div>
          ))}
        </div>
        <div className="text-text-3 flex justify-between text-sm">
          <span>
            {t({ fr: "Étape", en: "Step", pt: "Etapa" })}{" "}
            <b className="text-heading">{stepIndex + 1}</b> {t({ fr: "sur", en: "of", pt: "de" })}{" "}
            {steps.length}
          </span>
          <b key={currentStep.key} className="text-heading etape-libelle">
            {selon(langue, LIBELLES_ETAPES[currentStep.key])}
          </b>
        </div>
      </div>

      <div hidden={currentStep.key !== "identity"} className="etape-panneau">
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <Select
            label={t({ fr: "Civilité", en: "Title", pt: "Tratamento" })}
            name="civility"
            options={CIVILITES.map((option) => ({ value: option.value, label: t(option) }))}
          />
          <div />
          <Field
            label={t({ fr: "Prénom", en: "First name", pt: "Nome próprio" })}
            name="firstName"
            defaultValue={invitation?.firstName}
            required
          />
          <Field
            label={t({ fr: "Nom", en: "Last name", pt: "Apelido" })}
            name="lastName"
            defaultValue={invitation?.lastName}
            required
          />
          <Field
            label={t({ fr: "Adresse e-mail", en: "Email address", pt: "Endereço de e-mail" })}
            name="email"
            type="email"
            defaultValue={invitation?.email}
            readOnly={Boolean(invitation)}
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
              classeChamp="border-border bg-surface text-text rounded-lg border px-3 py-2.5"
            />
          </div>
          {/* Organisation avant le pays (28 octobre 2026), sur toute la
              largeur : pays et ville restent côte à côte. */}
          <div className="md:col-span-2">
            <Field
              label={t({ fr: "Organisation", en: "Organisation", pt: "Organização" })}
              name="organization"
            />
          </div>
          <Field label={t({ fr: "Pays", en: "Country", pt: "País" })} name="country" required />
          <Field label={t({ fr: "Ville", en: "City", pt: "Cidade" })} name="city" />
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label htmlFor="categoryId" className="text-heading text-sm font-semibold">
              {t({
                fr: "Catégorie de participation",
                en: "Participation category",
                pt: "Categoria de participação",
              })}
            </label>
            {invitation ? (
              /*
               * Invité (29 octobre 2026) : la catégorie est préremplie et
               * affichée en lecture seule ; c'est le champ caché qui l'envoie.
               * Elle passait par une liste désactivée, qu'un formulaire
               * n'envoie jamais : l'étape la croyait vide, « requise », et
               * l'invité ne pouvait plus avancer.
               */
              <>
                <input type="hidden" name="categoryId" value={invitation.category.id} />
                <input
                  id="categoryId"
                  value={libelleCategorie(invitation.category)}
                  readOnly
                  aria-describedby="categorie-invitation"
                  className="border-border bg-surface text-text rounded-lg border px-3 py-2.5 read-only:opacity-70"
                />
                <p id="categorie-invitation" className="text-text-3 text-xs">
                  {t({
                    fr: "Cette catégorie a été définie par le comité d'organisation.",
                    en: "This category was set by the organising committee.",
                    pt: "Esta categoria foi definida pela comissão organizadora.",
                  })}
                </p>
              </>
            ) : (
              <select
                id="categoryId"
                name="categoryId"
                required
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                className="border-border bg-surface text-text rounded-lg border px-3 py-2.5"
              >
                <option value="">{t({ fr: "Choisir…", en: "Choose…", pt: "Escolher…" })}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {libelleCategorie(category)}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      <div hidden={currentStep.key !== "profession"} className="etape-panneau">
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <Select
            label={t({
              fr: "Type d'organisation",
              en: "Type of organisation",
              pt: "Tipo de organização",
            })}
            name="organizationType"
            options={TYPES_ORGANISATION.map((option) => ({
              value: option.value,
              label: t(option),
            }))}
          />
          <Field label={t({ fr: "Fonction", en: "Position", pt: "Cargo" })} name="jobTitle" />
          <Field
            label={t({
              fr: "Domaine d'activité",
              en: "Field of activity",
              pt: "Área de atividade",
            })}
            name="activityDomain"
          />
          <Field
            label={t({ fr: "Site Internet", en: "Website", pt: "Sítio Web" })}
            name="website"
          />
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label htmlFor="bio" className="text-heading text-sm font-semibold">
              {t({ fr: "Biographie courte", en: "Short biography", pt: "Biografia curta" })}
            </label>
            <textarea
              id="bio"
              name="bio"
              rows={3}
              maxLength={300}
              placeholder={traduireErreur(langue, "300 caractères maximum")}
              className="border-border bg-surface text-text rounded-lg border px-3 py-2.5"
            />
          </div>
        </div>
      </div>

      <div hidden={currentStep.key !== "profession"} className="mt-6">
        <PhotoField
          onChange={setPhoto}
          langue={langue}
          label={t({
            fr: "Photo (facultative)",
            en: "Photo (optional)",
            pt: "Fotografia (facultativa)",
          })}
          hint={t({
            fr: "Elle figurera sur votre badge et facilitera le contrôle à l'entrée. Vous pourrez l'ajouter plus tard depuis « Mon espace ».",
            en: "It will appear on your badge and make the entrance check easier. You can add it later from “My space”.",
            pt: "Figurará no seu crachá e facilitará o controlo à entrada. Pode adicioná-la mais tarde a partir de «O meu espaço».",
          })}
        />
      </div>

      <div hidden={currentStep.key !== "participation"} className="etape-panneau">
        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-heading mb-1.5 text-sm font-semibold">
              {t({
                fr: "Jours de participation",
                en: "Days of attendance",
                pt: "Dias de participação",
              })}
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
                defaultChecked
              />
              <Checkbox
                label={t({
                  fr: "Cérémonie de distinction",
                  en: "Awards ceremony",
                  pt: "Cerimónia de distinção",
                })}
                name="attendsAwards"
              />
              {/* Remplace la conférence inaugurale (29 septembre 2026). */}
              <Checkbox
                label={t({
                  fr: "Cérémonie de clôture",
                  en: "Closing ceremony",
                  pt: "Cerimónia de encerramento",
                })}
                name="attendsClosing"
                defaultChecked
              />
            </div>
          </fieldset>
        </div>
      </div>

      <div hidden={currentStep.key !== "logistics"} className="etape-panneau">
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <Field
            label={t({ fr: "Date d'arrivée", en: "Arrival date", pt: "Data de chegada" })}
            name="arrivalDate"
            type="date"
          />
          <Field
            label={t({ fr: "Date de départ", en: "Departure date", pt: "Data de partida" })}
            name="departureDate"
            type="date"
          />
          <Field
            label={t({
              fr: "Régime alimentaire",
              en: "Dietary requirements",
              pt: "Regime alimentar",
            })}
            name="dietaryRequirements"
          />
          <Field
            label={t({
              fr: "Besoins particuliers",
              en: "Special needs",
              pt: "Necessidades especiais",
            })}
            name="specialNeeds"
          />
          <div className="flex flex-wrap gap-2.5 md:col-span-2">
            <Checkbox
              label={t({
                fr: "J'ai besoin d'un hébergement",
                en: "I need accommodation",
                pt: "Preciso de alojamento",
              })}
              name="needsAccommodation"
            />
            <Checkbox
              label={t({
                fr: "J'ai besoin d'un transport",
                en: "I need transport",
                pt: "Preciso de transporte",
              })}
              name="needsTransport"
            />
          </div>
        </div>
      </div>

      <div hidden={currentStep.key !== "consent"} className="etape-panneau">
        <div className="flex flex-col gap-2.5">
          <ConsentCheckbox
            label={t({
              fr: "J'accepte les conditions de participation au Forum.",
              en: "I accept the terms of participation in the Forum.",
              pt: "Aceito as condições de participação no Fórum.",
            })}
            name="consentTerms"
            checked={consents.consentTerms}
            onChange={(value) => setConsents((c) => ({ ...c, consentTerms: value }))}
          />
          <ConsentCheckbox
            label={t({
              fr: "Je consens à la collecte et à l'utilisation de mon adresse e-mail (loi n° 2008-12).",
              en: "I consent to the collection and use of my email address (Law No. 2008-12).",
              pt: "Consinto a recolha e a utilização do meu endereço de e-mail (Lei n.º 2008-12).",
            })}
            name="consentData"
            checked={consents.consentData}
            onChange={(value) => setConsents((c) => ({ ...c, consentData: value }))}
          />
          <ConsentCheckbox
            label={t({
              fr: "J'autorise la prise et l'utilisation de mon image dans les supports du Forum.",
              en: "I authorise the taking and use of my image in Forum materials.",
              pt: "Autorizo a captação e a utilização da minha imagem nos suportes do Fórum.",
            })}
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
      {state.envoiInterrompu && currentStep.key === "consent" && (
        <div
          role="alert"
          className="border-danger-text bg-danger-soft text-danger-text flex flex-col items-start gap-2.5 rounded-lg border p-3.5 text-sm"
        >
          <p>
            {t({
              fr: "L'envoi n'a pas abouti : la connexion a été coupée ou le serveur a renvoyé une réponse inattendue. Vos réponses sont conservées sur cette page ; réessayez dans un instant.",
              en: "Your submission did not go through: the connection was interrupted or the server sent an unexpected response. Your answers are kept on this page; try again in a moment.",
              pt: "O envio não foi concluído: a ligação foi interrompida ou o servidor devolveu uma resposta inesperada. As suas respostas estão guardadas nesta página; tente novamente dentro de instantes.",
            })}
          </p>
        </div>
      )}
      {state.duplicateEmail && (
        <p className="border-warn-text bg-warn-soft text-warn-text rounded-lg border p-3.5 text-sm">
          {t({
            fr: "Cette adresse e-mail est déjà inscrite. Utilisez ",
            en: "This email address is already registered. Use ",
            pt: "Este endereço de e-mail já está inscrito. Utilize ",
          })}
          <Link href="/mon-espace" className="font-semibold underline">
            {t({ fr: "« Mon espace »", en: "“My space”", pt: "«O meu espaço»" })}
          </Link>
          {t({
            fr: " pour recevoir un lien d'accès plutôt que de vous inscrire une seconde fois.",
            en: " to receive an access link rather than registering a second time.",
            pt: " para receber uma ligação de acesso em vez de se inscrever uma segunda vez.",
          })}
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
          {t({ fr: "Précédent", en: "Previous", pt: "Anterior" })}
        </button>
        {/*
          Une clé par bouton (30 octobre 2026) : sans elle, React gardait le
          même élément et passait son `type` de « button » à « submit » pendant
          le clic sur « Continuer ». Le navigateur achevait alors ce clic comme
          celui d'un bouton d'envoi : le formulaire partait dès l'arrivée sur
          la dernière étape, consentements décochés et photo comprise — une
          erreur s'affichait avant même le clic sur « Envoyer ».
        */}
        {stepIndex < steps.length - 1 ? (
          <button
            key="continuer"
            type="button"
            onClick={goNext}
            className="bg-primary text-primary-text hover:bg-primary-hover transition-tout inline-flex items-center gap-2 rounded-lg px-4.5 py-2.5 font-semibold shadow-sm hover:shadow-lg"
          >
            {t({ fr: "Continuer", en: "Continue", pt: "Continuar" })}
            <ArrowRight aria-hidden size={16} strokeWidth={2.2} />
          </button>
        ) : (
          <button
            key="envoyer"
            type="submit"
            disabled={pending}
            className="bg-primary text-primary-text hover:bg-primary-hover transition-tout inline-flex items-center gap-2 rounded-lg px-4.5 py-2.5 font-semibold shadow-sm hover:shadow-lg disabled:opacity-60"
          >
            <Send aria-hidden size={16} strokeWidth={2.2} />
            {pending
              ? t({ fr: "Envoi…", en: "Sending…", pt: "A enviar…" })
              : t({
                  fr: "Envoyer mon inscription",
                  en: "Submit my registration",
                  pt: "Enviar a minha inscrição",
                })}
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

function Select({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
}) {
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
