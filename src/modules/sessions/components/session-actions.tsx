"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Eye, EyeOff, Trash2 } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { confirmer } from "@/components/ui/confirmer";
import { deleteSessionAction, duplicateSessionAction, togglePublishedAction } from "../actions";

/**
 * Actions par ligne : publier, dupliquer, supprimer.
 *
 * La suppression est refusée par le service dès qu'une inscription existe ; le
 * message qui remonte le dit. Rien n'est masqué ici en fonction du nombre
 * d'inscrits : la règle vit à un seul endroit, et l'écran se contente de la
 * relayer.
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
  const [enCours, startTransition] = useTransition();
  const router = useRouter();

  function lancer(action: () => Promise<{ error?: string }>) {
    setErreur(null);
    startTransition(async () => {
      const resultat = await action();
      if (resultat.error) setErreur(resultat.error);
      else router.refresh();
    });
  }

  async function supprimer() {
    const confirme = await confirmer({
      titre: "Supprimer cette session ?",
      texte: `« ${titre} » sera retirée du programme. La suppression est refusée si des inscriptions existent.`,
      confirmer: "Supprimer",
      ton: "danger",
    });
    if (confirme) lancer(() => deleteSessionAction(id));
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
        onClick={() => lancer(() => togglePublishedAction(id, !isPublished))}
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
    </div>
  );
}
