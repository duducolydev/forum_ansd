"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Clapperboard, Plus } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { ajouterVideoAction, type EtatMedia } from "../actions";
import { lireLienVideo, NOM_FOURNISSEUR } from "../video";
import { preparerPhoto } from "../preparer-photo";

const etatInitial: EtatMedia = {};
const CHAMP = "border-border bg-bg text-text rounded-lg border px-3 py-2.5 text-sm";

/** Ajout d'une vidéo par son lien YouTube ou Vimeo. */
export function FormulaireVideo({ albumId }: { albumId: string | null }) {
  const [etat, action, enCours] = useActionState(
    async (precedent: EtatMedia, donnees: FormData): Promise<EtatMedia> => {
      // Vignette réduite ici, comme les photos : le serveur la plafonne.
      const vignette = donnees.get("vignette");
      if (vignette instanceof File && vignette.size > 0) {
        const preparee = await preparerPhoto(vignette);
        if (!preparee) return { erreur: "Vignette illisible (JPEG, PNG ou WebP)." };
        donnees.set("vignette", preparee.vignette);
      } else {
        donnees.delete("vignette");
      }
      return ajouterVideoAction(albumId, precedent, donnees);
    },
    etatInitial,
  );
  const [lien, setLien] = useState("");
  const formulaire = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const reconnue = lien ? lireLienVideo(lien) : null;

  useEffect(() => {
    if (etat.avis) {
      formulaire.current?.reset();
      setLien("");
      router.refresh();
    }
  }, [etat, router]);

  return (
    <form ref={formulaire} action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={`video-lien-${albumId ?? "libre"}`}
          className="text-heading text-sm font-semibold"
        >
          Lien de la vidéo
        </label>
        <input
          id={`video-lien-${albumId ?? "libre"}`}
          name="lien"
          type="url"
          required
          value={lien}
          onChange={(evenement) => setLien(evenement.target.value)}
          placeholder="https://www.youtube.com/watch?v=… ou https://vimeo.com/…"
          className={CHAMP}
        />
        <p className={`text-xs ${lien && !reconnue ? "text-danger-text" : "text-text-3"}`}>
          {!lien
            ? "YouTube ou Vimeo : la vidéo reste hébergée chez eux et se lit sur le site."
            : reconnue
              ? `Vidéo ${NOM_FOURNISSEUR[reconnue.fournisseur]} reconnue.`
              : "Lien non reconnu : YouTube (youtube.com, youtu.be) ou Vimeo uniquement."}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <input
          name="captionFr"
          placeholder="Titre ou légende (français)"
          aria-label="Légende en français"
          maxLength={500}
          className={CHAMP}
        />
        <input
          name="captionEn"
          placeholder="Titre ou légende (anglais)"
          aria-label="Légende en anglais"
          maxLength={500}
          className={CHAMP}
        />
        <input
          name="captionPt"
          placeholder="Titre ou légende (portugais)"
          aria-label="Légende en portugais"
          maxLength={500}
          className={CHAMP}
        />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-text-2 flex flex-1 flex-col gap-1 text-xs">
          Vignette (facultative — YouTube en fournit une ; conseillée pour Vimeo)
          <input
            name="vignette"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="text-sm"
          />
        </label>
        <Bouton
          ton="secondaire"
          icone={enCours ? Clapperboard : Plus}
          type="submit"
          disabled={enCours || !reconnue}
        >
          {enCours ? "Ajout…" : "Ajouter la vidéo"}
        </Bouton>
      </div>
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
    </form>
  );
}
