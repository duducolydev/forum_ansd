"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { BoutonSite } from "@/components/site/bouton-site";
import { PhotoField } from "@/modules/participants/components/photo-field";
import { deposerPhotoAction, type ActionState } from "../actions";

/**
 * Photo de l'intervenant, dans son espace.
 *
 * Elle partait telle quelle dans une Server Action, plafonnée à 3 Mo : une
 * photo de téléphone (4 à 8 Mo) était rejetée **avant** le code applicatif,
 * sans le moindre message (`lib/redimensionner-image.ts`). L'intervenant
 * croyait l'avoir déposée, et sa carte du site restait sur ses initiales
 * (5 novembre 2026).
 *
 * Même champ que la photo du participant : recadrée et réduite à 512 px dans
 * le navigateur, l'image envoyée pèse quelques dizaines de kilo-octets, quelle
 * que soit la photo d'origine — et perd au passage ses métadonnées EXIF.
 */
export function PhotoIntervenant({ speakerId, aPhoto }: { speakerId: string; aPhoto: boolean }) {
  const router = useRouter();
  const [fichier, setFichier] = useState<File | null>(null);
  const [etat, setEtat] = useState<ActionState>({});
  const [enCours, demarrer] = useTransition();

  function enregistrer() {
    if (!fichier) return;
    // `FormData` construit ici plutôt que par `<form action>` : c'est un
    // fichier produit par le recadrage, absent de tout champ du formulaire.
    const donnees = new FormData();
    donnees.set("photo", fichier);
    demarrer(async () => {
      const resultat = await deposerPhotoAction({}, donnees);
      setEtat(resultat);
      if (!resultat.error) {
        setFichier(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="border-border bg-surface flex flex-col gap-4 rounded-xl border p-5">
      <div>
        <h2 className="text-heading mb-1 text-base font-semibold">Votre photo</h2>
        <p className="text-text-3 text-xs">
          Elle paraît sur votre carte d&apos;intervenant et sur la fiche de vos sessions. JPEG, PNG
          ou WebP ; une photo de téléphone convient, elle est réduite avant l&apos;envoi.
        </p>
      </div>

      <PhotoField
        label="Photo"
        hint="Cadrez votre visage dans le cercle."
        // Paramètre changeant : certains navigateurs gardent l'ancienne image
        // après un remplacement, malgré l'absence de cache.
        photoActuelleUrl={aPhoto ? `/api/v1/speakers/${speakerId}/photo?v=${Date.now()}` : null}
        onChange={(nouveau) => {
          setFichier(nouveau);
          setEtat({});
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <BoutonSite
          type="button"
          taille="compact"
          icone={Save}
          disabled={!fichier || enCours}
          onClick={enregistrer}
        >
          {enCours ? "Envoi…" : aPhoto ? "Remplacer la photo" : "Enregistrer la photo"}
        </BoutonSite>
        {etat.error && (
          <p role="alert" className="text-danger-text text-sm">
            {etat.error}
          </p>
        )}
        {etat.message && !etat.error && (
          <p role="status" className="text-text-3 text-sm">
            {etat.message}
          </p>
        )}
      </div>
    </div>
  );
}
