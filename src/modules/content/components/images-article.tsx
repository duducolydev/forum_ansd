"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { auClicConfirme } from "@/components/ui/confirmer";
import {
  ajouterImageGalerieAction,
  retirerCouvertureAction,
  retirerImageGalerieAction,
  televerserCouvertureAction,
  type ActionState,
} from "../actions";
import { IMAGE_ARTICLE_MAX_BYTES, type ImageGalerie } from "../schema";
import { Plus, X } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";

const etatInitial: ActionState = {};
const CHAMP = "border-border bg-bg text-text rounded-lg border px-3 py-2.5 text-sm";
const BOUTON = "border-border text-heading rounded-lg border px-4 py-2 text-sm font-semibold";

const MO = IMAGE_ARTICLE_MAX_BYTES / 1024 / 1024;

/**
 * Couverture et galerie d'un article (§8.5).
 *
 * Séparé du formulaire de texte : un téléversement ne doit pas obliger à
 * réenregistrer le corps de l'article, ni un enregistrement de texte à
 * renvoyer les images.
 */
export function ImagesArticle({
  postId,
  aUneCouverture,
  galerie,
}: {
  postId: string;
  aUneCouverture: boolean;
  galerie: ImageGalerie[];
}) {
  const [etatCouverture, actionCouverture, couvertureEnCours] = useActionState(
    televerserCouvertureAction.bind(null, postId),
    etatInitial,
  );
  const [etatGalerie, actionGalerie, galerieEnCours] = useActionState(
    ajouterImageGalerieAction.bind(null, postId),
    etatInitial,
  );
  const [erreur, setErreur] = useState<string | null>(null);
  const [enRetrait, startTransition] = useTransition();
  const router = useRouter();

  function retirer(action: () => Promise<ActionState>) {
    setErreur(null);
    startTransition(async () => {
      const resultat = await action();
      if (resultat.error) setErreur(resultat.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="border-border bg-surface rounded-xl border p-5">
        <h3 className="text-heading mb-3 text-sm font-semibold">Image de couverture</h3>
        {aUneCouverture ? (
          <div className="mb-3 flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- servie par une route contrôlée, hors optimiseur */}
            <img
              src={`/api/v1/posts/${postId}/image/couverture`}
              alt="Couverture de l'article"
              className="border-border bg-bg max-h-32 rounded-lg border"
            />
            <Bouton
              ton="danger"
              icone={X}
              type="button"
              disabled={enRetrait}
              onClick={auClicConfirme(
                {
                  titre: "Retirer l'image de couverture ?",
                  texte: "Le fichier est supprimé du stockage ; l'article reste publié.",
                  confirmer: "Retirer",
                  ton: "danger",
                },
                () => retirer(() => retirerCouvertureAction(postId)),
              )}
            >
              Retirer
            </Bouton>
          </div>
        ) : (
          <p className="text-text-3 mb-3 text-sm">
            Aucune couverture. La liste d&apos;actualités affichera l&apos;article sans vignette.
          </p>
        )}

        <form action={actionCouverture} className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            name="image"
            accept="image/png,image/jpeg,image/webp"
            required
            aria-label="Fichier de couverture"
            className="text-text-2 text-sm"
          />
          <button type="submit" disabled={couvertureEnCours} className={BOUTON}>
            {couvertureEnCours ? "Envoi…" : aUneCouverture ? "Remplacer" : "Téléverser"}
          </button>
          <span className="text-text-3 basis-full text-xs">
            JPEG, PNG ou WebP, {MO} Mo maximum. Format paysage conseillé.
          </span>
        </form>
        {etatCouverture.error && (
          <p className="text-danger-text mt-2 text-sm">{etatCouverture.error}</p>
        )}
      </section>

      <section className="border-border bg-surface rounded-xl border p-5">
        <h3 className="text-heading mb-3 text-sm font-semibold">
          Galerie {galerie.length > 0 && `(${galerie.length})`}
        </h3>

        {galerie.length > 0 && (
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {galerie.map((image, rang) => (
              <figure key={image.path} className="flex flex-col gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element -- servie par une route contrôlée, hors optimiseur */}
                <img
                  src={`/api/v1/posts/${postId}/image/${rang}`}
                  alt={image.captionFr || `Image ${rang + 1}`}
                  className="border-border bg-bg h-24 w-full rounded-lg border object-cover"
                />
                <figcaption className="text-text-3 text-xs">
                  {image.captionFr || "Sans légende"}
                </figcaption>
                <Bouton
                  ton="danger"
                  icone={X}
                  type="button"
                  disabled={enRetrait}
                  onClick={auClicConfirme(
                    {
                      titre: "Retirer cette image ?",
                      texte: "Elle est supprimée du stockage et disparaît de la galerie publique.",
                      confirmer: "Retirer",
                      ton: "danger",
                    },
                    () => retirer(() => retirerImageGalerieAction(postId, rang)),
                  )}
                >
                  Retirer
                </Bouton>
              </figure>
            ))}
          </div>
        )}

        <form action={actionGalerie} className="flex flex-wrap items-end gap-2">
          <input
            type="file"
            name="image"
            accept="image/png,image/jpeg,image/webp"
            required
            aria-label="Fichier à ajouter à la galerie"
            className="text-text-2 text-sm"
          />
          <input
            name="captionFr"
            placeholder="Légende (français)"
            aria-label="Légende en français"
            className={`${CHAMP} min-w-[160px] flex-1`}
          />
          <input
            name="captionEn"
            placeholder="Légende (anglais)"
            aria-label="Légende en anglais"
            className={`${CHAMP} min-w-[160px] flex-1`}
          />
          <Bouton ton="secondaire" icone={Plus} type="submit" disabled={galerieEnCours}>
            {galerieEnCours ? "Envoi…" : "Ajouter"}
          </Bouton>
        </form>
        {etatGalerie.error && <p className="text-danger-text mt-2 text-sm">{etatGalerie.error}</p>}
      </section>

      {erreur && <p className="text-danger-text text-sm">{erreur}</p>}
    </div>
  );
}
