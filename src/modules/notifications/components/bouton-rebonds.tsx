"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MailWarning } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { releverRebondsAction } from "../actions";

/**
 * Relevé immédiat des avis « Adresse introuvable ». Le serveur le fait seul
 * toutes les quinze minutes ; le bouton sert juste après une campagne, quand
 * on veut savoir tout de suite quelles adresses étaient fausses.
 */
export function BoutonRebonds() {
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="flex flex-col items-end gap-1">
      <Bouton
        ton="secondaire"
        icone={MailWarning}
        disabled={enCours}
        onClick={() => {
          setMessage(null);
          setErreur(null);
          startTransition(async () => {
            const resultat = await releverRebondsAction();
            if (resultat.error) setErreur(resultat.error);
            else {
              setMessage(resultat.success ?? null);
              router.refresh();
            }
          });
        }}
      >
        {enCours ? "Lecture de la boîte…" : "Relever les rebonds"}
      </Bouton>
      {erreur && <p className="text-danger-text text-xs">{erreur}</p>}
      {message && (
        <p role="status" className="text-text-2 text-xs">
          {message}
        </p>
      )}
    </div>
  );
}
