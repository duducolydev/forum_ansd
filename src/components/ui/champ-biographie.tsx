"use client";

import { useState } from "react";
import { selon, type Langue } from "@/lib/langue";
import { BIOGRAPHIE_MAX_CARACTERES, BIOGRAPHIE_MAX_MOTS, compterMots } from "@/lib/biographie";

/**
 * Zone de saisie d'une biographie, avec son compteur de mots.
 *
 * Le navigateur borne les caractères (`maxLength`), pas les mots : sans
 * compteur, on ne découvrait le dépassement des 600 mots qu'au refus du
 * serveur, après avoir rédigé. Le compteur passe en rouge au-delà, et le
 * serveur reste juge (`schemaBiographie`).
 *
 * Non contrôlée, comme les autres champs des formulaires qui l'accueillent :
 * elle est envoyée par son `name`.
 */
export function ChampBiographie({
  id,
  name,
  defaultValue,
  disabled,
  rows = 6,
  className,
  langue = "fr",
  describedBy,
  placeholder,
}: {
  id: string;
  name: string;
  defaultValue?: string;
  disabled?: boolean;
  rows?: number;
  className: string;
  langue?: Langue;
  /** `id` d'une aide déjà affichée au-dessus, lue avec le compteur. */
  describedBy?: string;
  placeholder?: string;
}) {
  const [mots, setMots] = useState(() => compterMots(defaultValue ?? ""));
  const depasse = mots > BIOGRAPHIE_MAX_MOTS;
  const idCompteur = `${id}-compteur`;

  return (
    <>
      <textarea
        id={id}
        name={name}
        rows={rows}
        maxLength={BIOGRAPHIE_MAX_CARACTERES}
        defaultValue={defaultValue}
        disabled={disabled}
        placeholder={placeholder}
        aria-describedby={[describedBy, idCompteur].filter(Boolean).join(" ")}
        aria-invalid={depasse || undefined}
        onInput={(evenement) => setMots(compterMots(evenement.currentTarget.value))}
        className={className}
      />
      <span
        id={idCompteur}
        className={`text-xs ${depasse ? "text-danger-text font-semibold" : "text-text-3"}`}
      >
        {selon(langue, {
          fr: `${mots} / ${BIOGRAPHIE_MAX_MOTS} mots`,
          en: `${mots} / ${BIOGRAPHIE_MAX_MOTS} words`,
          pt: `${mots} / ${BIOGRAPHIE_MAX_MOTS} palavras`,
        })}
      </span>
    </>
  );
}
