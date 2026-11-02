import { lireLangue } from "./langue";

/**
 * Civilité abrégée devant un nom : « Dr Aminata SOW », « SE Amadou BA ».
 *
 * La civilité est saisie de plusieurs façons — liste du formulaire public
 * (« Madame », « Dr »…), texte libre du BackOffice et de l'import (« Mme »,
 * « Professeur », « S.E. »…). Elle est donc **reconnue** avant d'être abrégée ;
 * une valeur inconnue (« Me », « Ing. ») est affichée telle que saisie, puisque
 * quelqu'un l'a écrite exprès.
 *
 * Module sans dépendance serveur : il sert au badge comme aux pages.
 */
type Civilite = "MME" | "MR" | "DR" | "PR" | "SE";

const ABREVIATIONS: Record<Civilite, { fr: string; en: string; pt: string }> = {
  // « Mr » plutôt que « M. » : arbitrage du 2 novembre 2026, forum international.
  MME: { fr: "Mme", en: "Ms", pt: "Sra." },
  MR: { fr: "Mr", en: "Mr", pt: "Sr." },
  DR: { fr: "Dr", en: "Dr", pt: "Dr." },
  PR: { fr: "Pr", en: "Prof.", pt: "Prof." },
  SE: { fr: "SE", en: "H.E.", pt: "S. Exa." },
};

/** Formes reconnues, sans points, espaces ni accents, en minuscules. */
const FORMES: Record<string, Civilite> = {
  madame: "MME",
  mme: "MME",
  mrs: "MME",
  ms: "MME",
  mademoiselle: "MME",
  mlle: "MME",
  sra: "MME",
  senhora: "MME",
  monsieur: "MR",
  m: "MR",
  mr: "MR",
  mister: "MR",
  sr: "MR",
  senhor: "MR",
  dr: "DR",
  docteur: "DR",
  doctor: "DR",
  doutor: "DR",
  doutora: "DR",
  dra: "DR",
  pr: "PR",
  prof: "PR",
  professeur: "PR",
  professeure: "PR",
  professor: "PR",
  professora: "PR",
  se: "SE",
  sonexcellence: "SE",
  excellence: "SE",
  he: "SE",
  hisexcellency: "SE",
  herexcellency: "SE",
  sexa: "SE",
};

function forme(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

/** Abréviation de la civilité, ou chaîne vide s'il n'y en a pas. */
export function abregerCivilite(civilite: string | null | undefined, langue = "fr"): string {
  const saisie = civilite?.trim() ?? "";
  if (!saisie) return "";
  const reconnue = FORMES[forme(saisie)];
  return reconnue ? ABREVIATIONS[reconnue][lireLangue(langue)] : saisie;
}

/** Le nom précédé de la civilité abrégée, s'il y en a une. */
export function avecCivilite(
  civilite: string | null | undefined,
  nom: string,
  langue = "fr",
): string {
  const abreviation = abregerCivilite(civilite, langue);
  return abreviation ? `${abreviation} ${nom}` : nom;
}

/**
 * Civilité d'un intervenant : celle de sa fiche, sinon celle du participant
 * auquel il est rattaché (saisie à l'inscription).
 */
export function civiliteIntervenant(speaker: {
  civility?: string | null;
  participant?: { civility?: string | null } | null;
}): string | null {
  return speaker.civility?.trim() || speaker.participant?.civility?.trim() || null;
}
