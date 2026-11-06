"use client";

import { useMemo } from "react";
import { lireLangue, selon } from "@/lib/langue";
import { PAYS, trouverPays } from "@/lib/pays";
import { SelectRecherche } from "./select-recherche";

/**
 * Champ « Pays » : liste de tous les pays, avec recherche (6 novembre 2026).
 *
 * Remplace le texte libre de tous les formulaires — inscription, « Mon
 * espace », comptoir, fiches du BackOffice — qui laissait entrer « Sn »,
 * « Senegal » ou « SÉNÉGAL » pour un même pays (`lib/pays.ts`).
 *
 * La liste affiche le nom dans la langue de la page et enregistre le nom
 * français, valeur de référence. La recherche ignore accents et casse.
 *
 * Une valeur déjà enregistrée mais reconnue (« senegal ») est présentée sous
 * son nom de référence ; une valeur inconnue reste proposée, signalée, plutôt
 * qu'effacée sans que personne l'ait voulu.
 */
export function ChampPays({
  name = "country",
  id,
  defaultValue,
  langue: langueBrute = "fr",
  required,
  disabled,
  className,
}: {
  name?: string;
  id?: string;
  defaultValue?: string | null;
  langue?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const langue = lireLangue(langueBrute);
  const saisie = defaultValue?.trim() ?? "";
  const reconnu = trouverPays(saisie);
  const valeurInitiale = reconnu ? reconnu.fr : saisie;

  const options = useMemo(() => {
    const liste = PAYS.map((pays) => ({
      value: pays.fr,
      label: pays[langue],
      // Le nom français en second, pour retrouver un pays sous l'autre nom.
      detail: langue === "fr" ? undefined : pays.fr,
    })).sort((a, b) => a.label.localeCompare(b.label, langue));
    // Ancienne saisie non reconnue : conservée, et signalée.
    if (saisie && !reconnu) {
      liste.unshift({
        value: saisie,
        label: `${saisie} (${selon(langue, { fr: "à vérifier", en: "to check", pt: "a verificar" })})`,
        detail: undefined,
      });
    }
    return liste;
  }, [langue, saisie, reconnu]);

  return (
    <SelectRecherche
      name={name}
      id={id}
      defaultValue={valeurInitiale}
      options={options}
      labelVide={selon(langue, {
        fr: "Choisir un pays…",
        en: "Choose a country…",
        pt: "Escolher um país…",
      })}
      placeholderRecherche={selon(langue, {
        fr: "Rechercher un pays…",
        en: "Search for a country…",
        pt: "Pesquisar um país…",
      })}
      texteAucunResultat={selon(langue, {
        fr: "Aucun pays ne correspond.",
        en: "No matching country.",
        pt: "Nenhum país corresponde.",
      })}
      required={required}
      disabled={disabled}
      className={className}
    />
  );
}
