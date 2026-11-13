"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Eye, EyeOff, Trash2 } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { confirmerAvecOuSans } from "@/components/ui/confirmer";
import { deleteSessionAction, duplicateSessionAction, togglePublishedAction } from "../actions";

/**
 * Actions par ligne : publier, dupliquer, supprimer.
 *
 * La suppression est refusée par le service dès qu'une inscription existe ; le
 * message qui remonte le dit. Rien n'est masqué ici en fonction du nombre
 * d'inscrits : la règle vit à un seul endroit, et l'écran se contente de la
 * relayer.
 *
 * **Retirer une session ne prévient personne tout seul** (13 novembre 2026).
 * La boîte de dialogue pose la question en deux boutons — « Retirer et
 * prévenir » ou « Retirer sans prévenir » —, parce qu'après coup il n'y a plus
 * d'écran où le demander : la session a quitté la liste.
 */
export function SessionActions({
  id,
  titre,
  isPublished,
}: {
  id: string;
  titre: string;
  isPublished: boolean;
}) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();
  const router = useRouter();

  function lancer(action: () => Promise<{ error?: string; message?: string }>) {
    setErreur(null);
    setMessage(null);
    startTransition(async () => {
      const resultat = await action();
      if (resultat.error) setErreur(resultat.error);
      else {
        // Quand un envoi a eu lieu, l'écran dit combien de personnes ont été
        // prévenues : un départ silencieux se découvrirait par les réponses.
        setMessage(resultat.message ?? null);
        router.refresh();
      }
    });
  }

  async function supprimer() {
    const issue = await confirmerAvecOuSans({
      titre: "Supprimer cette session ?",
      texte: `« ${titre} » sera retirée du programme. La suppression est refusée si des inscriptions existent ; ses intervenants, eux, peuvent être avertis par e-mail.`,
      confirmer: "Supprimer et prévenir",
      sansPrevenir: "Supprimer sans prévenir",
      ton: "danger",
    });
    if (issue !== "annule") lancer(() => deleteSessionAction(id, issue === "avec"));
  }

  async function depublier() {
    const issue = await confirmerAvecOuSans({
      titre: "Dépublier cette session ?",
      texte: `« ${titre} » disparaîtra du programme public. Ses inscrits, la liste d'attente et ses intervenants peuvent être avertis de son retrait.`,
      confirmer: "Dépublier et prévenir",
      sansPrevenir: "Dépublier sans prévenir",
      ton: "danger",
    });
    if (issue !== "annule") lancer(() => togglePublishedAction(id, false, issue === "avec"));
  }

  /*
   * Boutons réduits à leur icône : la colonne d'actions occupait le tiers de la
   * largeur du tableau et repoussait le titre des sessions. `titre` porte
   * l'infobulle **et** le nom accessible — voir `components/ui/bouton.tsx`.
   */
  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <Bouton
        ton="discret"
        taille="petit"
        icone={isPublished ? EyeOff : Eye}
        titre={isPublished ? "Dépublier" : "Publier"}
        disabled={enCours}
        onClick={
          isPublished ? () => void depublier() : () => lancer(() => togglePublishedAction(id, true))
        }
      />
      <Bouton
        ton="discret"
        taille="petit"
        icone={Copy}
        titre="Dupliquer"
        disabled={enCours}
        onClick={() => lancer(() => duplicateSessionAction(id))}
      />
      <Bouton
        ton="danger"
        taille="petit"
        icone={Trash2}
        titre="Supprimer"
        disabled={enCours}
        onClick={() => void supprimer()}
      />
      {erreur && <p className="text-danger-text basis-full text-right text-xs">{erreur}</p>}
      {message && (
        <p role="status" className="text-text-2 basis-full text-right text-xs">
          {message}
        </p>
      )}
    </div>
  );
}
