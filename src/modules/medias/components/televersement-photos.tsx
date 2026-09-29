"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Upload } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { ZoneDepot } from "@/components/ui/zone-depot";
import { ajouterPhotoAction } from "../actions";
import { preparerPhoto } from "../preparer-photo";

const CHAMP = "border-border bg-bg text-text rounded-lg border px-3 py-2.5 text-sm";

/**
 * Envoi de photos en lot. Chaque photo est réduite dans le navigateur puis
 * envoyée **seule** : une requête reste sous les 3 Mo, et une photo refusée
 * n'empêche pas les suivantes de passer.
 */
export function TeleversementPhotos({ albumId }: { albumId: string | null }) {
  const champ = useRef<HTMLInputElement>(null);
  const [progression, setProgression] = useState<{ faites: number; total: number } | null>(null);
  const [echecs, setEchecs] = useState<string[]>([]);
  const [bilan, setBilan] = useState<string | null>(null);
  const router = useRouter();

  async function envoyer(formulaire: FormData) {
    const fichiers = Array.from(champ.current?.files ?? []);
    if (fichiers.length === 0) return;
    const credit = String(formulaire.get("credit") ?? "");
    const erreurs: string[] = [];
    setEchecs([]);
    setBilan(null);

    for (const [rang, fichier] of fichiers.entries()) {
      setProgression({ faites: rang, total: fichiers.length });
      const preparee = await preparerPhoto(fichier);
      if (!preparee) {
        erreurs.push(`${fichier.name} : image illisible ou trop lourde.`);
        continue;
      }
      const donnees = new FormData();
      donnees.set("photo", preparee.photo);
      donnees.set("vignette", preparee.vignette);
      donnees.set("largeur", String(preparee.largeur));
      donnees.set("hauteur", String(preparee.hauteur));
      donnees.set("credit", credit);
      const resultat = await ajouterPhotoAction(albumId, donnees);
      if (resultat.erreur) erreurs.push(`${fichier.name} : ${resultat.erreur}`);
    }

    const reussies = fichiers.length - erreurs.length;
    setProgression(null);
    setEchecs(erreurs);
    setBilan(`${reussies} photo${reussies > 1 ? "s" : ""} ajoutée${reussies > 1 ? "s" : ""}.`);
    if (champ.current) champ.current.value = "";
    router.refresh();
  }

  const enCours = progression !== null;

  return (
    <form action={envoyer} className="flex flex-col gap-3">
      <ZoneDepot
        name="photos"
        libelle="Photos à ajouter"
        icone={ImagePlus}
        accept="image/jpeg,image/png,image/webp"
        multiple
        required
        disabled={enCours}
        champRef={champ}
        invite="Glissez vos photos ici"
        aide="JPEG, PNG ou WebP, autant que vous voulez : elles sont réduites avant l'envoi"
      />
      <div className="flex flex-wrap items-end gap-3">
        <input
          name="credit"
          placeholder="Crédit photo (facultatif, pour tout le lot)"
          aria-label="Crédit photo"
          maxLength={150}
          className={`${CHAMP} min-w-[240px] flex-1`}
        />
        <Bouton ton="principal" icone={Upload} type="submit" disabled={enCours}>
          {enCours
            ? `Envoi ${progression.faites + 1} / ${progression.total}…`
            : "Ajouter les photos"}
        </Bouton>
      </div>
      {enCours && (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progression.total}
          aria-valuenow={progression.faites}
          aria-label="Envoi des photos"
          className="bg-bg-3 h-2 overflow-hidden rounded-full"
        >
          <div
            className="bg-primary h-full transition-[width]"
            style={{ width: `${(progression.faites / progression.total) * 100}%` }}
          />
        </div>
      )}
      {bilan && (
        <p role="status" className="text-accent-text text-sm">
          {bilan}
        </p>
      )}
      {echecs.length > 0 && (
        <ul role="alert" className="text-danger-text text-sm">
          {echecs.map((echec) => (
            <li key={echec}>{echec}</li>
          ))}
        </ul>
      )}
    </form>
  );
}
