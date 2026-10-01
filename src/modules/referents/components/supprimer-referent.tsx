"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { auClicConfirme } from "@/components/ui/confirmer";
import { deleteReferentAction } from "../actions";

/**
 * Suppression d'une fiche de référent, sur confirmation nommant la personne.
 *
 * Une suppression est irréversible et la fiche porte des coordonnées qu'on ne
 * retrouvera pas ailleurs — un clic malheureux dans une liste ne doit pas
 * suffire.
 *
 * Le refus du serveur, quand des délégations sont encore rattachées, est
 * affiché tel quel : il compte combien, ce qu'un message générique ne dirait
 * pas.
 */
export function SupprimerReferent({ referentId, nom }: { referentId: string; nom: string }) {
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
            titre: `Supprimer la fiche de ${nom} ?`,
            texte: "La suppression est définitive.",
            confirmer: "Supprimer la fiche",
            ton: "danger",
          },
          () =>
            startTransition(async () => {
              setErreur(null);
              const resultat = await deleteReferentAction(referentId, {});
              if (resultat.error) {
                setErreur(resultat.error);
                return;
              }
              router.push("/admin/referents");
            }),
        )}
      >
        {enCours ? "Suppression…" : "Supprimer la fiche"}
      </Bouton>
      {erreur && <p className="text-danger-text mt-2 text-sm">{erreur}</p>}
    </>
  );
}
