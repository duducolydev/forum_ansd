"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Film,
  ImageIcon,
  Save,
  Star,
  Trash2,
} from "lucide-react";
import { auClicConfirme, informer } from "@/components/ui/confirmer";
import {
  basculerVisibiliteAction,
  changerAlbumAction,
  definirCouvertureAction,
  deplacerElementAction,
  modifierLegendeAction,
  supprimerElementAction,
  type EtatMedia,
} from "../actions";

export interface ElementAdmin {
  id: string;
  type: "PHOTO" | "VIDEO";
  vignette: string | null;
  fournisseur: string | null;
  captionFr: string;
  captionEn: string;
  credit: string;
  isPublished: boolean;
}

const etatInitial: EtatMedia = {};
const CHAMP = "border-border bg-bg text-text w-full rounded-md border px-2 py-1.5 text-xs";
const PETIT =
  "border-border text-text-2 hover:text-heading hover:bg-bg-2 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs disabled:opacity-40";

function CarteElement({
  element,
  albumId,
  estCouverture,
  albums,
  premier,
  dernier,
}: {
  element: ElementAdmin;
  albumId: string | null;
  estCouverture: boolean;
  albums: { id: string; titre: string }[];
  premier: boolean;
  dernier: boolean;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [etat, enregistrer, enregistrement] = useActionState(
    modifierLegendeAction.bind(null, element.id),
    etatInitial,
  );

  function agir(action: () => Promise<EtatMedia>) {
    demarrer(async () => {
      const resultat = await action();
      if (resultat.erreur) void informer("Action impossible", resultat.erreur);
      router.refresh();
    });
  }

  return (
    <li
      className={`border-border bg-surface flex flex-col overflow-hidden rounded-xl border ${
        element.isPublished ? "" : "opacity-60"
      }`}
    >
      <div className="bg-bg-3 relative aspect-[4/3]">
        <span aria-hidden className="text-text-3 absolute inset-0 grid place-items-center">
          {element.type === "VIDEO" ? <Film size={28} /> : <ImageIcon size={28} />}
        </span>
        {element.vignette && (
          /* eslint-disable-next-line @next/next/no-img-element -- servie par une route contrôlée */
          <img
            src={element.vignette}
            alt=""
            loading="lazy"
            onError={(evenement) => {
              evenement.currentTarget.hidden = true;
            }}
            className="relative h-full w-full object-cover"
          />
        )}
        <span className="absolute top-2 left-2 flex gap-1">
          <span className="bg-surface/90 text-heading inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold">
            {element.type === "VIDEO" ? (
              <Film aria-hidden size={12} />
            ) : (
              <ImageIcon aria-hidden size={12} />
            )}
            {element.type === "VIDEO"
              ? element.fournisseur === "vimeo"
                ? "Vimeo"
                : "YouTube"
              : "Photo"}
          </span>
          {estCouverture && (
            <span className="bg-gold-soft text-gold-text rounded-full px-2 py-0.5 text-[11px] font-semibold">
              Couverture
            </span>
          )}
          {!element.isPublished && (
            <span className="bg-surface/90 text-text-2 rounded-full px-2 py-0.5 text-[11px] font-semibold">
              Masqué
            </span>
          )}
        </span>
      </div>

      <form action={enregistrer} className="flex flex-col gap-1.5 p-3">
        <input
          name="captionFr"
          defaultValue={element.captionFr}
          placeholder="Légende (français)"
          aria-label="Légende en français"
          maxLength={500}
          className={CHAMP}
        />
        <input
          name="captionEn"
          defaultValue={element.captionEn}
          placeholder="Légende (anglais)"
          aria-label="Légende en anglais"
          maxLength={500}
          className={CHAMP}
        />
        <div className="flex gap-1.5">
          <input
            name="credit"
            defaultValue={element.credit}
            placeholder="Crédit"
            aria-label="Crédit"
            maxLength={150}
            className={CHAMP}
          />
          <button
            type="submit"
            disabled={enregistrement}
            className={PETIT}
            title="Enregistrer la légende"
          >
            <Save aria-hidden size={13} />
            <span className="sr-only">Enregistrer la légende</span>
          </button>
        </div>
        {etat.erreur && <p className="text-danger-text text-xs">{etat.erreur}</p>}
        {etat.avis && <p className="text-accent-text text-xs">{etat.avis}</p>}
      </form>

      <div className="border-border mt-auto flex flex-wrap items-center gap-1.5 border-t p-3">
        <button
          type="button"
          className={PETIT}
          disabled={enCours || premier}
          onClick={() => agir(() => deplacerElementAction(element.id, -1))}
          aria-label="Déplacer avant"
          title="Déplacer avant"
        >
          <ArrowLeft aria-hidden size={13} />
        </button>
        <button
          type="button"
          className={PETIT}
          disabled={enCours || dernier}
          onClick={() => agir(() => deplacerElementAction(element.id, 1))}
          aria-label="Déplacer après"
          title="Déplacer après"
        >
          <ArrowRight aria-hidden size={13} />
        </button>
        <button
          type="button"
          className={PETIT}
          disabled={enCours}
          onClick={() => agir(() => basculerVisibiliteAction(element.id))}
        >
          {element.isPublished ? <EyeOff aria-hidden size={13} /> : <Eye aria-hidden size={13} />}
          {element.isPublished ? "Masquer" : "Afficher"}
        </button>
        {albumId && !estCouverture && (
          <button
            type="button"
            className={PETIT}
            disabled={enCours}
            onClick={() => agir(() => definirCouvertureAction(albumId, element.id))}
          >
            <Star aria-hidden size={13} />
            Couverture
          </button>
        )}
        <select
          aria-label="Ranger dans un album"
          disabled={enCours}
          value={albumId ?? ""}
          onChange={(evenement) => {
            const cible = evenement.target.value || null;
            agir(() => changerAlbumAction(element.id, cible));
          }}
          className="border-border bg-bg text-text-2 max-w-[9.5rem] rounded-md border px-1.5 py-1 text-xs"
        >
          <option value="">Hors album</option>
          {albums.map((album) => (
            <option key={album.id} value={album.id}>
              {album.titre}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`${PETIT} hover:text-danger-text ml-auto`}
          disabled={enCours}
          onClick={auClicConfirme(
            {
              titre: element.type === "VIDEO" ? "Retirer cette vidéo ?" : "Supprimer cette photo ?",
              texte:
                element.type === "VIDEO"
                  ? "Elle disparaît de la médiathèque (la vidéo reste chez son hébergeur)."
                  : "Le fichier est supprimé du stockage.",
              confirmer: "Supprimer",
              ton: "danger",
            },
            () => agir(() => supprimerElementAction(element.id)),
          )}
          aria-label="Supprimer"
          title="Supprimer"
        >
          <Trash2 aria-hidden size={13} />
        </button>
      </div>
    </li>
  );
}

/** Éléments d'un album (ou hors album) avec leurs actions. */
export function GrilleElements({
  elements,
  albumId,
  couvertureId,
  albums,
}: {
  elements: ElementAdmin[];
  albumId: string | null;
  couvertureId: string | null;
  albums: { id: string; titre: string }[];
}) {
  if (elements.length === 0) {
    return <p className="text-text-3 text-sm">Aucune photo ni vidéo pour l&apos;instant.</p>;
  }
  // Sans couverture choisie, c'est la première photo qui en tient lieu.
  const couverture =
    couvertureId ?? elements.find((element) => element.type === "PHOTO")?.id ?? null;
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {elements.map((element, rang) => (
        <CarteElement
          key={element.id}
          element={element}
          albumId={albumId}
          estCouverture={albumId !== null && element.id === couverture}
          albums={albums}
          premier={rang === 0}
          dernier={rang === elements.length - 1}
        />
      ))}
    </ul>
  );
}
