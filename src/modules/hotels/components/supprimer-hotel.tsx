"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { auClicConfirme } from "@/components/ui/confirmer";
import { deleteHotelAction } from "../actions";

/**
 * Retrait d'un hôtel, sur confirmation nommant l'établissement.
 *
 * Une fiche d'hôtel porte des tarifs négociés pendant des semaines : un clic
 * dans une liste ne doit pas suffire à la faire disparaître du site.
 */
export function SupprimerHotel({ hotelId, nom }: { hotelId: string; nom: string }) {
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();

  return (
    <>
      <Bouton
        ton="danger"
        taille="petit"
        icone={Trash2}
        disabled={enCours}
        onClick={auClicConfirme(
          {
            titre: `Retirer « ${nom} » du site ?`,
            texte: "La fiche et ses tarifs ne seront plus proposés aux participants.",
            confirmer: "Retirer l'hôtel",
            ton: "danger",
          },
          () =>
            startTransition(async () => {
              setErreur(null);
              const resultat = await deleteHotelAction(hotelId, {});
              if (resultat.error) {
                setErreur(resultat.error);
                return;
              }
              router.push("/admin/hotels");
            }),
        )}
      >
        {enCours ? "Retrait…" : "Retirer l'hôtel"}
      </Bouton>
      {erreur && <p className="text-danger-text mt-2 text-sm">{erreur}</p>}
    </>
  );
}
