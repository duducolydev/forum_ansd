"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { confirmer } from "@/components/ui/confirmer";
import { PhotoField } from "@/modules/participants/components/photo-field";
import type { ActionState } from "../actions";
import { deposerPhotoComiteAction, retirerPhotoComiteAction } from "../photo-comite-actions";
import type { CiblePhoto } from "../service";

/**
 * Dépôt de la photo par le comité, sur la fiche d'un participant ou d'un
 * intervenant (9 novembre 2026).
 *
 * Même champ que partout : recadrée et réduite à 512 px dans le navigateur,
 * l'image envoyée pèse quelques dizaines de kilo-octets, quelle que soit la
 * photo reçue par e-mail ou prise sur un site officiel.
 */
export function PhotoComite({
  cible,
  photoUrl,
  nom,
}: {
  cible: CiblePhoto;
  /** Photo actuelle ; `null` sans photo. */
  photoUrl: string | null;
  nom: string;
}) {
  const router = useRouter();
  const [fichier, setFichier] = useState<File | null>(null);
  const [retour, setRetour] = useState<ActionState>({});
  // Change après chaque envoi : le champ revient à la photo enregistrée.
  const [envois, setEnvois] = useState(0);
  const [enCours, demarrer] = useTransition();

  function terminer(resultat: ActionState) {
    setRetour(resultat);
    if (resultat.error) return;
    setFichier(null);
    setEnvois((n) => n + 1);
    router.refresh();
  }

  function enregistrer() {
    if (!fichier) return;
    const donnees = new FormData();
    donnees.set("photo", fichier);
    demarrer(async () => terminer(await deposerPhotoComiteAction(cible, donnees)));
  }

  function retirer() {
    void confirmer({
      titre: `Retirer la photo de ${nom} ?`,
      texte: "Elle disparaît de sa fiche, de son badge et du site.",
      confirmer: "Retirer la photo",
      ton: "danger",
    }).then((accepte) => {
      if (accepte) demarrer(async () => terminer(await retirerPhotoComiteAction(cible)));
    });
  }

  return (
    <section
      id="photo"
      aria-labelledby="titre-photo-comite"
      className="border-border bg-surface flex scroll-mt-20 flex-col gap-3 rounded-xl border p-5"
    >
      <h3 id="titre-photo-comite" className="text-heading text-sm font-semibold">
        Photo
      </h3>
      <p className="text-text-3 -mt-2 text-xs">
        À déposer pour les personnes qui ne le feront pas elles-mêmes. Elle figure sur le badge et,
        si la fiche intervenant est publiée, sur le site.
      </p>

      <PhotoField
        key={envois}
        label=""
        photoActuelleUrl={photoUrl}
        onChange={(nouveau) => {
          setFichier(nouveau);
          setRetour({});
        }}
        onRemove={photoUrl ? retirer : undefined}
        aideCadrage="Cadrez le visage dans le cercle : ce cadrage figurera sur le badge et sur le site. Déplacez l'image en la faisant glisser, ou avec les flèches du clavier."
      />

      <div className="flex flex-wrap items-center gap-3">
        {fichier && (
          <Bouton
            type="button"
            ton="principal"
            icone={Save}
            disabled={enCours}
            onClick={enregistrer}
          >
            {enCours ? "Enregistrement…" : "Enregistrer la photo"}
          </Bouton>
        )}
        {retour.error && (
          <p role="alert" className="text-danger-text text-sm">
            {retour.error}
          </p>
        )}
        {retour.message && !retour.error && (
          <p role="status" className="text-accent-text text-sm">
            {retour.message}
          </p>
        )}
      </div>
    </section>
  );
}
