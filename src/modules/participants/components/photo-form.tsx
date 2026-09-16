"use client";
import { Save } from "lucide-react";
import { BoutonSite } from "@/components/site/bouton-site";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PhotoField } from "./photo-field";
import { removeMyPhotoAction, updateMyPhotoAction, type MySpaceState } from "../my-space-actions";

/**
 * Photo de profil dans l'espace participant.
 *
 * L'action est appelée directement avec un `FormData` construit ici, sans
 * passer par `<form action={…}>` : c'est un fichier, et la sérialisation
 * automatique de React a déjà perdu des valeurs sur ce projet (cf. T32).
 */
export function PhotoForm({
  participantId,
  photoEnregistree,
}: {
  participantId: string;
  photoEnregistree: boolean;
}) {
  const router = useRouter();
  const [fichier, setFichier] = useState<File | null>(null);
  const [etat, setEtat] = useState<MySpaceState>({});
  const [enCours, demarrer] = useTransition();

  function enregistrer() {
    if (!fichier) return;
    const data = new FormData();
    data.set("photo", fichier);

    demarrer(async () => {
      const resultat = await updateMyPhotoAction(data);
      setEtat(resultat);
      if (resultat.success) {
        setFichier(null);
        router.refresh();
      }
    });
  }

  function retirer() {
    demarrer(async () => {
      setEtat(await removeMyPhotoAction());
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <PhotoField
        // L'URL porte un paramètre changeant : la route interdit la mise en
        // cache, mais certains navigateurs conservent malgré tout l'ancienne
        // image après un remplacement.
        photoActuelleUrl={
          photoEnregistree ? `/api/v1/participants/${participantId}/photo?v=${Date.now()}` : null
        }
        onChange={setFichier}
        onRemove={photoEnregistree ? retirer : undefined}
        label="Photo de badge"
        hint="Facultative, mais elle facilite le contrôle à l'entrée du Forum."
      />

      {fichier && (
        <BoutonSite
          type="button"
          onClick={enregistrer}
          disabled={enCours}
          ton="principal"
          taille="compact"
          icone={Save}
          className="w-fit"
        >
          {enCours ? "Enregistrement…" : "Enregistrer la photo"}
        </BoutonSite>
      )}

      {etat.error && <p className="text-danger-text text-sm">{etat.error}</p>}
      {etat.success && <p className="text-accent-text text-sm">{etat.success}</p>}
    </div>
  );
}
