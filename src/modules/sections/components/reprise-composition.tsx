"use client";

import { useActionState } from "react";
import { PencilLine } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { reprendreCompositionAction, type EtatAction } from "../actions";

const etatInitial: EtatAction = {};

/**
 * « Modifier la composition actuelle » : inscrit en base les sections que la
 * page affiche déjà, pour les régler une à une. Rien ne change à l'écran.
 */
export function RepriseComposition({ page }: { page: string }) {
  const [etat, action, enCours] = useActionState(
    reprendreCompositionAction.bind(null, page),
    etatInitial,
  );

  return (
    <form action={action} className="mt-4">
      <Bouton ton="principal" icone={PencilLine} type="submit" disabled={enCours}>
        {enCours ? "Reprise…" : "Modifier la composition actuelle"}
      </Bouton>
      {etat.erreur && <p className="text-danger-text mt-2 text-sm">{etat.erreur}</p>}
    </form>
  );
}
