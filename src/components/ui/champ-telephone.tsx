"use client";

import { useEffect, useMemo, useRef } from "react";
import { joindreTelephone, listeIndicatifs, separerTelephone } from "@/lib/telephone";

/**
 * Téléphone avec indicatif du pays.
 *
 * Deux contrôles natifs — la liste des indicatifs et le numéro — que le
 * formulaire envoie **recombinés** sous le nom attendu par le serveur
 * (`phone` = `+221 77 123 45 67`). Les actions serveur, les schémas et la base
 * n'ont donc pas changé.
 *
 * La recombinaison passe par l'événement `formdata`, déclenché à chaque
 * `new FormData(form)` — soumission d'une action serveur comprise. Les deux
 * parties restent **non contrôlées** et gardent chacune un nom : le brouillon
 * local de l'inscription, qui sauvegarde et restaure les champs par leur nom
 * directement dans le DOM, continue de fonctionner sans rien savoir d'elles.
 *
 * Une liste native plutôt qu'un menu dessiné : elle se parcourt au clavier en
 * tapant les premières lettres du pays, s'ouvre en roue sur téléphone, et les
 * lecteurs d'écran la connaissent.
 */
export function ChampTelephone({
  id,
  name,
  defaultValue,
  classeChamp,
  disabled,
  langue = "fr",
}: {
  /** `id` du champ du numéro, que vise le `<label>` du formulaire. */
  id: string;
  name: string;
  defaultValue?: string | null;
  /** Classes des champs du formulaire hôte, pour que les deux contrôles s'y fondent. */
  classeChamp: string;
  disabled?: boolean;
  langue?: "fr" | "en";
}) {
  const indicatifs = useMemo(() => listeIndicatifs(langue), [langue]);
  const initial = useMemo(() => separerTelephone(defaultValue), [defaultValue]);
  const refIndicatif = useRef<HTMLSelectElement>(null);
  const refNumero = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const formulaire = refNumero.current?.form;
    if (!formulaire) return;

    function recombiner(evenement: FormDataEvent) {
      // Un champ désactivé n'est pas envoyé : le numéro ne doit pas l'être non plus.
      if (!refIndicatif.current || !refNumero.current || refNumero.current.disabled) return;
      evenement.formData.set(
        name,
        joindreTelephone(refIndicatif.current.value, refNumero.current.value),
      );
    }

    formulaire.addEventListener("formdata", recombiner);
    return () => formulaire.removeEventListener("formdata", recombiner);
  }, [name]);

  return (
    <div className="flex gap-2">
      <select
        ref={refIndicatif}
        name={`${name}_indicatif`}
        defaultValue={initial.pays}
        disabled={disabled}
        aria-label={langue === "en" ? "Country calling code" : "Indicatif du pays"}
        className={`${classeChamp} w-40 shrink-0 sm:w-52`}
      >
        {indicatifs.map((indicatif) => (
          <option key={indicatif.pays} value={indicatif.pays}>
            {indicatif.nom} (+{indicatif.code})
          </option>
        ))}
      </select>
      <input
        ref={refNumero}
        id={id}
        name={`${name}_national`}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        maxLength={22}
        defaultValue={initial.national}
        disabled={disabled}
        className={`${classeChamp} min-w-0 flex-1`}
      />
    </div>
  );
}
