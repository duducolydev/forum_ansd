"use client";

import {
  ajusterPourFonds,
  assombrirJusquAuSeuil,
  CONTRASTE_MIN,
  formaterRatio,
  verifierCouleur,
  verifierSurFonds,
} from "../regles";
import { CHAMP } from "./champs";

/**
 * Choix d'une couleur avec son verdict de contraste, calculé à la frappe.
 *
 * Le serveur refuse une couleur sous le seuil (cf. `service.enregistrerTheme`) ;
 * cet aperçu évite d'aller au refus pour l'apprendre, et propose la teinte la
 * plus proche qui passe. Refuser sans montrer comment corriger, c'est dire non
 * sans dire comment.
 *
 * Deux régimes, parce que deux usages : une couleur qui **porte du texte**
 * (bouton, lien) se juge contre son texte ; une couleur qui doit **se détacher**
 * d'un fond — le contour de focus — se juge contre les fonds des deux thèmes.
 */
export function ChoixCouleur({
  nom,
  label,
  valeur,
  onChange,
  aide,
  seuil = CONTRASTE_MIN,
  fonds,
}: {
  nom: string;
  label: string;
  valeur: string;
  onChange: (couleur: string) => void;
  aide?: string;
  seuil?: number;
  /** Fourni : la couleur se juge contre ces fonds. Absent : contre son texte. */
  fonds?: readonly string[];
}) {
  const surFonds = fonds !== undefined;
  const verdict = surFonds
    ? verifierSurFonds(valeur, fonds, seuil)
    : verifierCouleur(valeur, seuil);
  const suggestion = surFonds
    ? ajusterPourFonds(valeur, fonds, seuil)
    : assombrirJusquAuSeuil(valeur, seuil);
  const texteExemple = surFonds ? "#ffffff" : verifierCouleur(valeur, seuil).texte;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`couleur-${nom}`} className="text-text-3 text-xs font-semibold">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={`couleur-${nom}`}
          type="color"
          value={valeur}
          onChange={(event) => onChange(event.target.value)}
          className="border-border h-10 w-12 shrink-0 cursor-pointer rounded-lg border"
        />
        <input
          name={nom}
          value={valeur}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
          aria-label={`${label} — code hexadécimal`}
          className={`${CHAMP} w-28 font-mono`}
        />
        {surFonds ? (
          <span aria-hidden className="flex flex-1 gap-1">
            <span
              style={{ background: "#ffffff", outline: `3px solid ${valeur}`, outlineOffset: -3 }}
              className="h-10 flex-1 rounded-lg"
            />
            <span
              style={{ background: "#061e38", outline: `3px solid ${valeur}`, outlineOffset: -3 }}
              className="h-10 flex-1 rounded-lg"
            />
          </span>
        ) : (
          <span
            aria-hidden
            style={{ background: valeur, color: texteExemple }}
            className="grid h-10 flex-1 place-items-center rounded-lg text-sm font-semibold"
          >
            Exemple
          </span>
        )}
      </div>

      {aide && <span className="text-text-3 text-xs">{aide}</span>}

      <span className={`text-xs ${verdict.conforme ? "text-accent-text" : "text-danger-text"}`}>
        {formaterRatio(verdict.ratio)}
        {surFonds ? " sur le fond le moins favorable" : " avec son texte"} —{" "}
        {verdict.conforme ? (
          "conforme"
        ) : (
          <>
            sous le minimum de {formaterRatio(seuil)}.{" "}
            {suggestion ? (
              <button type="button" onClick={() => onChange(suggestion)} className="underline">
                Utiliser la teinte la plus proche qui passe ({suggestion})
              </button>
            ) : (
              "Aucune teinte proche ne tient sur les deux thèmes : choisissez une autre couleur."
            )}
          </>
        )}
      </span>
    </div>
  );
}
