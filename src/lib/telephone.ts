import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/min";

/**
 * Indicatifs téléphoniques par pays (demande du commanditaire, 28 septembre 2026).
 *
 * La table vient de `libphonenumber-js` plutôt que d'une liste recopiée : les
 * indicatifs changent rarement mais changent, et une table écrite à la main se
 * trompe sans que rien le signale. Les noms de pays viennent d'`Intl`, donc
 * dans la langue de la page sans rien traduire.
 *
 * Le numéro reste stocké en **une seule chaîne**, `+221 77 123 45 67` : les
 * exports, les badges et les courriels l'affichaient déjà ainsi, et un champ
 * de plus en base n'aurait rien apporté à ceux qui le lisent.
 */

export const PAYS_PAR_DEFAUT: CountryCode = "SN";

export interface Indicatif {
  pays: CountryCode;
  /** Sans le « + ». */
  code: string;
  nom: string;
}

export function listeIndicatifs(langue: "fr" | "en" = "fr"): Indicatif[] {
  const noms = new Intl.DisplayNames([langue], { type: "region" });
  return getCountries()
    .map((pays) => ({ pays, code: getCountryCallingCode(pays), nom: noms.of(pays) ?? pays }))
    .sort((a, b) => a.nom.localeCompare(b.nom, langue));
}

/**
 * Sépare un numéro enregistré en indicatif et numéro national.
 *
 * Un numéro saisi avant l'arrivée des indicatifs n'en porte pas : il est alors
 * rattaché au Sénégal et laissé tel quel, plutôt que réinterprété — mieux vaut
 * un indicatif à corriger qu'un numéro défiguré.
 */
export function separerTelephone(valeur: string | null | undefined): {
  pays: CountryCode;
  national: string;
} {
  const propre = (valeur ?? "").trim();
  const international = propre.replace(/^00/, "+");
  if (!international.startsWith("+")) return { pays: PAYS_PAR_DEFAUT, national: propre };

  const chiffres = international.slice(1).replace(/\D/g, "");
  const analyse = parsePhoneNumberFromString(international);
  const code = analyse?.countryCallingCode ?? indicatifLePlusLong(chiffres);
  if (!code) return { pays: PAYS_PAR_DEFAUT, national: propre };

  // Pays : celui que reconnaît le numéro, sinon le premier qui porte cet
  // indicatif (+1 → États-Unis, que le numéro soit canadien ou américain).
  const pays =
    analyse?.country ?? getCountries().find((candidat) => getCountryCallingCode(candidat) === code);

  // Le numéro national garde la mise en forme saisie : on retire seulement
  // l'indicatif en tête, chiffre par chiffre.
  let reste = international.slice(1);
  let aRetirer = code.length;
  while (aRetirer > 0 && reste.length > 0) {
    if (/\d/.test(reste[0]!)) aRetirer -= 1;
    reste = reste.slice(1);
  }

  return { pays: pays ?? PAYS_PAR_DEFAUT, national: reste.replace(/^[\s.\-)]+/, "").trim() };
}

function indicatifLePlusLong(chiffres: string): string | undefined {
  const codes = new Set(getCountries().map((pays) => getCountryCallingCode(pays)));
  for (let longueur = 3; longueur >= 1; longueur -= 1) {
    const candidat = chiffres.slice(0, longueur);
    if (codes.has(candidat)) return candidat;
  }
  return undefined;
}

/** `+221 77 123 45 67`, ou une chaîne vide si aucun numéro n'est saisi. */
export function joindreTelephone(pays: string, national: string): string {
  const numero = national.trim();
  if (!numero) return "";
  let code: string;
  try {
    code = getCountryCallingCode(pays as CountryCode);
  } catch {
    code = getCountryCallingCode(PAYS_PAR_DEFAUT);
  }
  // Un indicatif ressaisi par habitude dans le numéro n'est pas doublé.
  const sansIndicatif = numero.replace(new RegExp(`^(\\+|00)${code}[\\s.-]*`), "");
  return `+${code} ${sansIndicatif}`;
}
