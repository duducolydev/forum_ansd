"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { creerParticipantAction } from "../actions";

/**
 * « Créer le participant depuis l'intervenant » (brief §5.8).
 *
 * Bouton explicite et non création automatique : tous les intervenants n'ont
 * pas vocation à être inscrits au Forum, et un participant créé sans qu'on l'ait
 * voulu apparaîtrait dans les comptages et les envois groupés.
 */
export function CreateParticipantButton({
  speakerId,
  disabled,
}: {
  speakerId: string;
  disabled?: boolean;
}) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="flex flex-col items-end gap-1">
      <Bouton
        ton="secondaire"
        taille="petit"
        icone={UserPlus}
        disabled={enCours || disabled}
        titre={
          disabled
            ? "Renseignez d'abord une adresse e-mail."
            : "Créer la fiche participant correspondante, pour le badge et la présence"
        }
        onClick={() => {
          setErreur(null);
          startTransition(async () => {
            const resultat = await creerParticipantAction(speakerId);
            if (resultat.error) setErreur(resultat.error);
            else router.refresh();
          });
        }}
      >
        {enCours ? "Création…" : "Créer le participant"}
      </Bouton>
      {erreur && <p className="text-danger-text text-xs">{erreur}</p>}
    </div>
  );
}
