"use client";

import { selon, type Langue } from "@/lib/langue";
import { useEffect, useMemo, useRef, useState } from "react";
import { getCountries, getCountryCallingCode } from "libphonenumber-js/min";
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
/** Liste identique sur le serveur et dans le navigateur : codes ISO, sans `Intl`. */
const INDICATIFS_NEUTRES = getCountries()
  .map((pays) => ({ pays, code: getCountryCallingCode(pays), nom: pays as string }))
  .sort((a, b) => a.pays.localeCompare(b.pays));

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
  langue?: Langue;
}) {
  /*
   * La liste est construite dans le navigateur seulement. Les noms de pays
   * viennent d'`Intl.DisplayNames`, dont les données diffèrent entre Node et
   * le navigateur (« Hong Kong » ou « R.A.S. chinoise de Hong Kong »…) : la
   * même liste calculée des deux côtés n'avait ni les mêmes libellés ni le
   * même ordre, et React signalait une erreur d'hydratation.
   *
   * Au rendu serveur (et à l'hydratation), toutes les options sont donc
   * posées avec un libellé qui ne dépend de rien : « CI (+225) », par code de
   * pays. Elles existent dès le départ — le brouillon de l'inscription peut y
   * restaurer un indicatif —, puis prennent leur nom dans la langue de la
   * page une fois le composant monté.
   */
  const [indicatifs, setIndicatifs] = useState(INDICATIFS_NEUTRES);
  useEffect(() => setIndicatifs(listeIndicatifs(langue)), [langue]);
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
        aria-label={selon(langue, {
          fr: "Indicatif du pays",
          en: "Country calling code",
          pt: "Indicativo do país",
        })}
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
