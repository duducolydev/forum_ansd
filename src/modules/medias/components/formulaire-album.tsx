"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus, Save } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { creerAlbumAction, modifierAlbumAction, type EtatMedia } from "../actions";

const etatInitial: EtatMedia = {};
const CHAMP = "border-border bg-bg text-text w-full rounded-lg border px-3 py-2.5 text-sm";
const ETIQUETTE = "text-text-3 text-xs font-semibold";

export interface ValeursAlbum {
  id: string;
  titleFr: string;
  titleEn: string;
  descriptionFr: string;
  descriptionEn: string;
  eventDate: string;
  isPublished: boolean;
}

/** Création (sans `album`) ou modification d'un album. */
export function FormulaireAlbum({ album }: { album?: ValeursAlbum }) {
  const [etat, action, enCours] = useActionState(
    album ? modifierAlbumAction.bind(null, album.id) : creerAlbumAction,
    etatInitial,
  );
  const router = useRouter();

  // Album créé : on ouvre sa page pour y déposer les photos.
  useEffect(() => {
    if (etat.albumId) router.push(`/admin/mediatheque/${etat.albumId}`);
  }, [etat.albumId, router]);

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className={ETIQUETTE}>Titre (français) *</span>
          <input
            name="titleFr"
            required
            minLength={2}
            maxLength={150}
            defaultValue={album?.titleFr}
            className={CHAMP}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={ETIQUETTE}>Titre (anglais — repli FR si vide)</span>
          <input name="titleEn" maxLength={150} defaultValue={album?.titleEn} className={CHAMP} />
        </label>
        {album && (
          <>
            <label className="flex flex-col gap-1">
              <span className={ETIQUETTE}>Description (français)</span>
              <textarea
                name="descriptionFr"
                rows={3}
                maxLength={2000}
                defaultValue={album.descriptionFr}
                className={CHAMP}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={ETIQUETTE}>Description (anglais)</span>
              <textarea
                name="descriptionEn"
                rows={3}
                maxLength={2000}
                defaultValue={album.descriptionEn}
                className={CHAMP}
              />
            </label>
          </>
        )}
        <label className="flex flex-col gap-1">
          <span className={ETIQUETTE}>Date du moment (facultative)</span>
          <input name="eventDate" type="date" defaultValue={album?.eventDate} className={CHAMP} />
        </label>
        <label className="text-text flex items-center gap-2 self-end pb-2.5 text-sm">
          <input name="isPublished" type="checkbox" defaultChecked={album?.isPublished ?? false} />
          Publié sur le site
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Bouton ton="principal" icone={album ? Save : FolderPlus} type="submit" disabled={enCours}>
          {enCours ? "Enregistrement…" : album ? "Enregistrer l'album" : "Créer l'album"}
        </Bouton>
        {etat.erreur && (
          <p role="alert" className="text-danger-text text-sm">
            {etat.erreur}
          </p>
        )}
        {etat.avis && (
          <p role="status" className="text-accent-text text-sm">
            {etat.avis}
          </p>
        )}
      </div>
    </form>
  );
}
