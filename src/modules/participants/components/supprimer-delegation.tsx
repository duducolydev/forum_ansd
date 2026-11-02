"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { auClicConfirme } from "@/components/ui/confirmer";
import { deleteDelegationAction } from "../actions";

/**
 * Suppression d'une délégation, sur confirmation nommant la délégation et
 * comptant ses membres : ils restent inscrits, mais perdent leur délégation et
 * le chef son rôle — à savoir avant de cliquer, pas après.
 *
 * Depuis la fiche, on revient à la liste ; depuis la liste, on y reste.
 */
export function SupprimerDelegation({
  delegationId,
  nom,
  membres,
  depuisFiche = false,
}: {
  delegationId: string;
  nom: string;
  membres: number;
  depuisFiche?: boolean;
}) {
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();

  const texte =
    membres === 0
      ? "La délégation n'a aucun membre. La suppression est définitive."
      : `Ses ${membres} membre(s) restent inscrits au Forum, mais sans délégation ; le chef de délégation perd ce rôle. La suppression est définitive.`;

  return (
    <div>
      <Bouton
        ton="danger"
        taille="petit"
        icone={Trash2}
        disabled={enCours}
        onClick={auClicConfirme(
          {
            titre: `Supprimer la délégation « ${nom} » ?`,
            texte,
            confirmer: "Supprimer la délégation",
            ton: "danger",
          },
          () =>
            startTransition(async () => {
              setErreur(null);
              const resultat = await deleteDelegationAction(delegationId);
              if (resultat.error) {
                setErreur(resultat.error);
                return;
              }
              if (depuisFiche) router.push("/admin/delegations");
              else router.refresh();
            }),
        )}
      >
        {enCours ? "Suppression…" : "Supprimer"}
      </Bouton>
      {erreur && <p className="text-danger-text mt-2 text-sm">{erreur}</p>}
    </div>
  );
}
