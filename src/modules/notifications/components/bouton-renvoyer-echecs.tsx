"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { confirmer } from "@/components/ui/confirmer";
import { renvoyerEchecsAction } from "../actions";

/**
 * Reprise des envois restés en échec (18 novembre 2026).
 *
 * Le bouton ne s'affiche que s'il y a quelque chose à reprendre, et il annonce
 * le nombre : un bouton « Renvoyer » qui ne dit pas combien de messages il va
 * faire partir ne se presse pas tranquillement la veille d'un forum.
 *
 * Une confirmation est demandée. Le geste est sans retour — des messages
 * partent chez de vraies personnes — et le décompte seul ne suffit pas à
 * mesurer ce qu'on déclenche.
 */
export function BoutonRenvoyerEchecs({ enAttente }: { enAttente: number }) {
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();
  const router = useRouter();

  if (enAttente === 0 && !message) return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <Bouton
        ton="secondaire"
        icone={RotateCw}
        disabled={enCours || enAttente === 0}
        onClick={() => {
          const pluriel = enAttente > 1 ? "s" : "";
          void confirmer({
            titre: `Renvoyer ${enAttente} e-mail${pluriel} ?`,
            texte:
              "Les destinataires qui ont finalement reçu le message, et les adresses qui " +
              "ont rebondi, sont écartés. Les envois sont étalés pour ménager la boîte " +
              "d'envoi.",
            confirmer: "Renvoyer",
          }).then((accepte) => {
            if (!accepte) return;
            setMessage(null);
            setErreur(null);
            startTransition(async () => {
              const resultat = await renvoyerEchecsAction();
              if (resultat.error) setErreur(resultat.error);
              else {
                setMessage(resultat.success ?? null);
                router.refresh();
              }
            });
          });
        }}
      >
        {enCours ? "Remise en file…" : `Renvoyer les échecs (${enAttente})`}
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
