"use client";

import { useActionState, useId } from "react";
import { Save } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { EditeurTexteRiche } from "@/components/ui/editeur-texte-riche";
import { TAILLE_MAX_DOCUMENT } from "@/lib/texte-riche";
import { ajouterImageAction, type EtatAction } from "../actions";
import { LONGUEUR_MAX_CORPS } from "../schema";

const etatInitial: EtatAction = {};
const CHAMP = "border-border bg-surface text-text w-full rounded-lg border px-3 py-2.5";

interface Valeurs {
  titleFr?: string;
  titleEn?: string;
  excerptFr?: string;
  excerptEn?: string;
  bodyFr?: string;
  bodyEn?: string;
  isPublished?: boolean;
}

/**
 * Rédaction d'une newsletter (§34).
 *
 * Les images ne sont proposées qu'à la **modification**, pas à la création :
 * une image se rattache à une newsletter, et celle-ci n'a pas encore
 * d'identifiant tant qu'elle n'est pas enregistrée. Le premier enregistrement
 * ouvre donc l'éditeur complet, ce que le formulaire annonce.
 */
export function FormulaireNewsletter({
  action,
  defaultValues,
  submitLabel,
  newsletterId,
  clesImages,
}: {
  action: (etat: EtatAction, formData: FormData) => Promise<EtatAction>;
  defaultValues?: Valeurs;
  submitLabel: string;
  /** Absent à la création : les images ne sont alors pas proposées. */
  newsletterId?: string;
  clesImages?: number[];
}) {
  const [etat, formAction, enCours] = useActionState(action, etatInitial);
  const d = defaultValues ?? {};
  const idFr = useId();
  const idEn = useId();

  const images = newsletterId
    ? {
        urlBase: `/api/v1/newsletters/${newsletterId}/image`,
        cles: clesImages ?? [],
        televerser: async (fichier: File): Promise<number | null> => {
          const donnees = new FormData();
          donnees.set("image", fichier);
          const resultat = await ajouterImageAction(newsletterId, {}, donnees);
          return resultat.cleImage ?? null;
        },
      }
    : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="titleFr" className="text-heading text-sm font-semibold">
            Titre (français)
          </label>
          <input id="titleFr" name="titleFr" required defaultValue={d.titleFr} className={CHAMP} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="titleEn" className="text-heading text-sm font-semibold">
            Titre (anglais)
          </label>
          <input id="titleEn" name="titleEn" defaultValue={d.titleEn} className={CHAMP} />
          <span className="text-text-3 text-xs">Vide, le français est repris.</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="excerptFr" className="text-heading text-sm font-semibold">
            Chapô (français)
          </label>
          <textarea
            id="excerptFr"
            name="excerptFr"
            required
            rows={3}
            maxLength={600}
            defaultValue={d.excerptFr}
            className={CHAMP}
          />
          <span className="text-text-3 text-xs">
            C&apos;est ce texte qui part dans l&apos;e-mail d&apos;annonce, avec le titre et le
            lien. 600 caractères au maximum.
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="excerptEn" className="text-heading text-sm font-semibold">
            Chapô (anglais)
          </label>
          <textarea
            id="excerptEn"
            name="excerptEn"
            rows={3}
            maxLength={600}
            defaultValue={d.excerptEn}
            className={CHAMP}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span id={idFr} className="text-heading text-sm font-semibold">
          Corps (français)
        </span>
        <EditeurTexteRiche
          id="corps-fr"
          name="bodyFr"
          labelId={idFr}
          libelle="Corps en français"
          valeurInitiale={d.bodyFr ?? ""}
          max={LONGUEUR_MAX_CORPS}
          images={images}
        />
        {!newsletterId && (
          <span className="text-text-3 text-xs">
            Les images s&apos;ajoutent après le premier enregistrement : elles se rattachent à la
            newsletter, qui n&apos;existe pas encore.
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <span id={idEn} className="text-heading text-sm font-semibold">
          Corps (anglais)
        </span>
        <EditeurTexteRiche
          id="corps-en"
          name="bodyEn"
          labelId={idEn}
          libelle="Corps en anglais"
          valeurInitiale={d.bodyEn ?? ""}
          max={LONGUEUR_MAX_CORPS}
          images={images}
        />
      </div>

      <label className="text-text flex items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          name="isPublished"
          defaultChecked={d.isPublished ?? false}
          className="size-4"
        />
        Publiée sur le site
        <span className="text-text-3 text-xs">
          La publication ne déclenche aucun envoi : le bouton est séparé, et il ne se reprend pas.
        </span>
      </label>

      {etat.erreur && <p className="text-danger-text text-sm">{etat.erreur}</p>}
      {etat.avis && <p className="text-accent-text text-sm">{etat.avis}</p>}

      <div>
        <Bouton ton="principal" icone={Save} type="submit" disabled={enCours}>
          {enCours ? "Enregistrement…" : submitLabel}
        </Bouton>
      </div>

      {/* La limite du document sérialisé est bien plus haute que celle du texte
          visible : le balisage et les attributs d'image y comptent aussi. */}
      <input type="hidden" name="_tailleMax" value={TAILLE_MAX_DOCUMENT} />
    </form>
  );
}
