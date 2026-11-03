"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { auClicConfirme } from "@/components/ui/confirmer";
import { deleteInvitationAction } from "../actions";

/**
 * Suppression d'une invitation créée par erreur, sur confirmation nommant
 * l'invité. Quand l'invitation est déjà partie, la confirmation le rappelle :
 * le lien reçu cessera de fonctionner.
 */
export function SupprimerInvitation({
  invitationId,
  nom,
  dejaEnvoyee,
}: {
  invitationId: string;
  nom: string;
  dejaEnvoyee: boolean;
}) {
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
            titre: `Supprimer l'invitation de ${nom} ?`,
            texte: dejaEnvoyee
              ? "La suppression est définitive, et le lien déjà envoyé ne fonctionnera plus."
              : "La suppression est définitive.",
            confirmer: "Supprimer l'invitation",
            ton: "danger",
          },
          () =>
            startTransition(async () => {
              setErreur(null);
              const resultat = await deleteInvitationAction(invitationId);
              if (resultat.error) {
                setErreur(resultat.error);
                return;
              }
              router.push("/admin/invitations");
            }),
        )}
      >
        {enCours ? "Suppression…" : "Supprimer l'invitation"}
      </Bouton>
      {erreur && <p className="text-danger-text mt-2 text-sm">{erreur}</p>}
    </>
  );
}
