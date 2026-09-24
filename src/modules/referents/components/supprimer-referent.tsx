"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { deleteReferentAction } from "../actions";

/**
 * Suppression d'une fiche de référent, en deux gestes.
 *
 * Le premier clic ne supprime rien : il remplace le bouton par une question
 * nommant la personne. Une suppression est irréversible et la fiche porte des
 * coordonnées qu'on ne retrouvera pas ailleurs — un clic malheureux dans une
 * liste ne doit pas suffire.
 *
 * Le refus du serveur, quand des délégations sont encore rattachées, est
 * affiché tel quel : il compte combien, ce qu'un message générique ne dirait
 * pas.
 */
export function SupprimerReferent({ referentId, nom }: { referentId: string; nom: string }) {
  const router = useRouter();
  const [confirme, setConfirme] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();

  if (!confirme) {
    return (
      <>
        <Bouton ton="danger" taille="petit" icone={Trash2} onClick={() => setConfirme(true)}>
          Supprimer la fiche
        </Bouton>
        {erreur && <p className="text-danger-text mt-2 text-sm">{erreur}</p>}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-text text-sm">
        Supprimer définitivement la fiche de <strong>{nom}</strong> ?
      </p>
      <div className="flex gap-2">
        <Bouton
          ton="danger"
          taille="petit"
          icone={Trash2}
          disabled={enCours}
          onClick={() =>
            startTransition(async () => {
              const resultat = await deleteReferentAction(referentId, {});
              if (resultat.error) {
                setErreur(resultat.error);
                setConfirme(false);
                return;
              }
              router.push("/admin/referents");
            })
          }
        >
          {enCours ? "Suppression…" : "Oui, supprimer"}
        </Bouton>
        <Bouton ton="discret" taille="petit" disabled={enCours} onClick={() => setConfirme(false)}>
          Annuler
        </Bouton>
      </div>
      {erreur && <p className="text-danger-text text-sm">{erreur}</p>}
    </div>
  );
}
