"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bouton } from "@/components/ui/bouton";
import { confirmer, informer } from "@/components/ui/confirmer";
import { deleteParticipantAction } from "../actions";

/**
 * Suppression définitive d'un participant (28 octobre 2026), au pied de sa
 * fiche. Réservée à la permission `participants.delete`.
 */
export function SuppressionParticipant({
  participantId,
  nom,
  email,
}: {
  participantId: string;
  nom: string;
  email: string;
}) {
  const router = useRouter();
  const [enCours, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  function supprimer() {
    setErreur(null);
    void confirmer({
      titre: `Supprimer définitivement ${nom} ?`,
      texte: `Sa fiche, sa photo, ses badges, ses réservations, ses passages aux contrôles et l'historique de ses e-mails seront effacés. C'est irréversible. L'adresse ${email} pourra servir à une nouvelle inscription.`,
      confirmer: "Supprimer définitivement",
      annuler: "Ne rien supprimer",
      ton: "danger",
    }).then((accepte) => {
      if (!accepte) return;
      startTransition(async () => {
        const resultat = await deleteParticipantAction(participantId);
        if (resultat.error) {
          setErreur(resultat.error);
          return;
        }
        router.replace("/admin/participants");
        void informer("Participant supprimé", `${nom} et ses données ont été effacés.`);
      });
    });
  }

  return (
    <div className="border-danger-text/40 bg-surface mt-5 rounded-xl border p-5">
      <h3 className="text-danger-text mb-1 text-sm font-semibold">Suppression définitive</h3>
      <p className="text-text-2 mb-3 text-sm">
        Efface la fiche et toutes les données du participant — photo, badges, réservations, passages
        aux contrôles, e-mails envoyés. La personne pourra se réinscrire avec la même adresse. Le
        journal d&apos;audit garde la trace de la suppression.
      </p>
      <Bouton type="button" ton="danger" icone={Trash2} disabled={enCours} onClick={supprimer}>
        {enCours ? "Suppression…" : "Supprimer définitivement"}
      </Bouton>
      {erreur && <p className="text-danger-text mt-2 text-sm">{erreur}</p>}
    </div>
  );
}
