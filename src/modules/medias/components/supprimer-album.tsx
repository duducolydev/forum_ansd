"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { auClicConfirme, informer } from "@/components/ui/confirmer";
import { supprimerAlbumAction } from "../actions";

export function SupprimerAlbum({ albumId, elements }: { albumId: string; elements: number }) {
  const [enCours, demarrer] = useTransition();
  const router = useRouter();

  return (
    <Bouton
      ton="danger"
      icone={Trash2}
      type="button"
      disabled={enCours}
      onClick={auClicConfirme(
        {
          titre: "Supprimer cet album ?",
          texte:
            elements > 0
              ? `Ses ${elements} photo(s) et vidéo(s) sont supprimées avec lui, fichiers compris.`
              : "L'album est vide.",
          confirmer: "Supprimer l'album",
          ton: "danger",
        },
        () =>
          demarrer(async () => {
            const resultat = await supprimerAlbumAction(albumId);
            if (resultat.erreur) {
              void informer("Suppression impossible", resultat.erreur);
              return;
            }
            router.push("/admin/mediatheque");
          }),
      )}
    >
      {enCours ? "Suppression…" : "Supprimer l'album"}
    </Bouton>
  );
}
