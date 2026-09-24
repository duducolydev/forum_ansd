"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { deleteHotelAction } from "../actions";

/**
 * Retrait d'un hôtel, en deux gestes.
 *
 * Le premier clic ne retire rien : il remplace le bouton par une question
 * nommant l'établissement. Une fiche d'hôtel porte des tarifs négociés pendant
 * des semaines, et un clic dans une liste ne doit pas suffire à la faire
 * disparaître du site.
 */
export function SupprimerHotel({ hotelId, nom }: { hotelId: string; nom: string }) {
  const router = useRouter();
  const [confirme, setConfirme] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();

  if (!confirme) {
    return (
      <>
        <Bouton ton="danger" taille="petit" icone={Trash2} onClick={() => setConfirme(true)}>
          Retirer l&apos;hôtel
        </Bouton>
        {erreur && <p className="text-danger-text mt-2 text-sm">{erreur}</p>}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-text text-sm">
        Retirer <strong>{nom}</strong> du site ?
      </p>
      <div className="flex gap-2">
        <Bouton
          ton="danger"
          taille="petit"
          icone={Trash2}
          disabled={enCours}
          onClick={() =>
            startTransition(async () => {
              const resultat = await deleteHotelAction(hotelId, {});
              if (resultat.error) {
                setErreur(resultat.error);
                setConfirme(false);
                return;
              }
              router.push("/admin/hotels");
            })
          }
        >
          {enCours ? "Retrait…" : "Oui, retirer"}
        </Bouton>
        <Bouton ton="discret" taille="petit" disabled={enCours} onClick={() => setConfirme(false)}>
          Annuler
        </Bouton>
      </div>
      {erreur && <p className="text-danger-text text-sm">{erreur}</p>}
    </div>
  );
}
