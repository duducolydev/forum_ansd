import { lireLangue, selon, type Langue } from "@/lib/langue";
import type { RegistrationStepKey } from "./registration-schema";

/**
 * Traductions du parcours public (inscription, connexion à « Mon espace »).
 *
 * Les schémas Zod gardent leurs messages en français : ils servent aussi au
 * BackOffice et aux tests. Le message d'erreur est traduit **à l'affichage**,
 * par sa forme française — un message absent de la table reste tel quel
 * plutôt que de disparaître.
 *
 * Module sans dépendance serveur : il sert au formulaire comme aux actions.
 */
const ERREURS: Record<string, { en: string; pt: string }> = {
  "Le prénom est requis": {
    en: "First name is required",
    pt: "O nome próprio é obrigatório",
  },
  "Le nom est requis": {
    en: "Last name is required",
    pt: "O apelido é obrigatório",
  },
  "L'adresse e-mail est requise": {
    en: "Email address is required",
    pt: "O endereço de e-mail é obrigatório",
  },
  "Adresse e-mail invalide": {
    en: "Invalid email address",
    pt: "Endereço de e-mail inválido",
  },
  "Le pays est requis": {
    en: "Country is required",
    pt: "O país é obrigatório",
  },
  "La catégorie de participation est requise": {
    en: "Participation category is required",
    pt: "A categoria de participação é obrigatória",
  },
  "5000 caractères maximum": {
    en: "5,000 characters maximum",
    pt: "5000 caracteres no máximo",
  },
  "600 mots maximum": {
    en: "600 words maximum",
    pt: "600 palavras no máximo",
  },
  "Sélectionnez au moins une journée": {
    en: "Select at least one day",
    pt: "Selecione pelo menos um dia",
  },
  "Date invalide": {
    en: "Invalid date",
    pt: "Data inválida",
  },
  "La date de départ précède la date d'arrivée": {
    en: "The departure date is before the arrival date",
    pt: "A data de partida é anterior à data de chegada",
  },
  "Vous devez accepter les conditions de participation": {
    en: "You must accept the terms of participation",
    pt: "Tem de aceitar as condições de participação",
  },
  "Le consentement au traitement des données est nécessaire pour vous inscrire": {
    en: "Consent to the processing of your data is required to register",
    pt: "O consentimento para o tratamento dos seus dados é necessário para se inscrever",
  },
  "Requête rejetée": {
    en: "Request rejected",
    pt: "Pedido rejeitado",
  },
  "Étape incomplète": {
    en: "Incomplete step",
    pt: "Etapa incompleta",
  },
  "Une erreur est survenue.": {
    en: "An error occurred.",
    pt: "Ocorreu um erro.",
  },
  "Les informations ne sont plus modifiables en ligne. Adressez-vous à l'accueil du Forum.": {
    en: "Your details can no longer be edited online. Please go to the Forum reception desk.",
    pt: "Os seus dados já não podem ser alterados em linha. Dirija-se à receção do Fórum.",
  },
};

/**
 * Mot à saisir pour confirmer une demande de suppression, dans chaque langue.
 * Le serveur les accepte tous : la langue peut changer entre l'affichage du
 * formulaire et son envoi.
 */
export const MOT_SUPPRESSION = { fr: "SUPPRIMER", en: "DELETE", pt: "ELIMINAR" };

/** Message d'erreur d'un schéma, dans la langue du visiteur. */
export function traduireErreur(langue: string, message: string): string {
  const cle = lireLangue(langue);
  if (cle === "fr") return message;
  return ERREURS[message]?.[cle] ?? message;
}

/** « Trop de tentatives » et ses variantes, avec le délai d'attente. */
export function messageAttente(langue: Langue, secondes: number): string {
  return selon(langue, {
    fr: `Trop de tentatives. Réessayez dans ${secondes} seconde(s).`,
    en: `Too many attempts. Try again in ${secondes} second(s).`,
    pt: `Demasiadas tentativas. Tente novamente dentro de ${secondes} segundo(s).`,
  });
}

/*
 * Civilité et type d'organisation : la **valeur** enregistrée reste française,
 * comme avant l'ouverture des autres langues — le BackOffice, les exports et
 * les badges la lisent telle quelle. Seul le libellé affiché suit la langue.
 */
export const CIVILITES = [
  { value: "Madame", fr: "Madame", en: "Mrs / Ms", pt: "Senhora" },
  { value: "Monsieur", fr: "Monsieur", en: "Mr", pt: "Senhor" },
  { value: "Dr", fr: "Dr", en: "Dr", pt: "Dr." },
  { value: "Pr", fr: "Pr", en: "Prof.", pt: "Prof." },
  { value: "SE", fr: "SE", en: "H.E.", pt: "S. Exa." },
];

export const TYPES_ORGANISATION = [
  {
    value: "Institut national de statistique",
    fr: "Institut national de statistique",
    en: "National statistics office",
    pt: "Instituto nacional de estatística",
  },
  {
    value: "Organisation internationale",
    fr: "Organisation internationale",
    en: "International organisation",
    pt: "Organização internacional",
  },
  {
    value: "Administration publique",
    fr: "Administration publique",
    en: "Public administration",
    pt: "Administração pública",
  },
  {
    value: "Université / recherche",
    fr: "Université / recherche",
    en: "University / research",
    pt: "Universidade / investigação",
  },
  { value: "Secteur privé", fr: "Secteur privé", en: "Private sector", pt: "Setor privado" },
  { value: "Média", fr: "Média", en: "Media", pt: "Comunicação social" },
];

export const LIBELLES_ETAPES: Record<RegistrationStepKey, { fr: string; en: string; pt: string }> =
  {
    identity: { fr: "Identité", en: "Identity", pt: "Identidade" },
    profession: { fr: "Profession", en: "Profession", pt: "Profissão" },
    participation: { fr: "Participation", en: "Participation", pt: "Participação" },
    logistics: { fr: "Logistique", en: "Logistics", pt: "Logística" },
    consent: { fr: "Consentements", en: "Consents", pt: "Consentimentos" },
  };
