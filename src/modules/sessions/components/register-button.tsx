"use client";
import { Hourglass, Lock, TicketCheck, X } from "lucide-react";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EtatSession } from "../service";

export type StatutParticipant = "AUCUN" | "REGISTERED" | "WAITLISTED" | "ATTENDED";

/**
 * Bouton de réservation d'une session (brief §5.5).
 *
 * L'écran ne décide de rien : il envoie la demande et affiche ce que le serveur
 * répond. Vérifier la capacité ici en plus produirait deux règles à tenir
 * d'accord, et c'est précisément entre les deux que la dernière place se perd.
 */
export function RegisterButton({
  sessionId,
  etat,
  statut,
  connecte,
}: {
  sessionId: string;
  etat: EtatSession;
  statut: StatutParticipant;
  connecte: boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();
  const router = useRouter();

  function appeler(methode: "POST" | "DELETE") {
    setErreur(null);
    setMessage(null);
    startTransition(async () => {
      const reponse = await fetch(`/api/v1/sessions/${sessionId}/register`, { method: methode });
      const corps = (await reponse.json()) as {
        error?: string;
        detail?: string;
        statut?: string;
        position?: number;
      };

      if (!reponse.ok) {
        setErreur(corps.detail ? `${corps.error} (${corps.detail})` : (corps.error ?? "Échec."));
        return;
      }

      if (corps.statut === "LISTE_ATTENTE") {
        setMessage(`Vous êtes en liste d'attente, position ${corps.position}.`);
      } else if (methode === "POST") {
        setMessage("Votre place est réservée.");
      } else {
        setMessage("Votre réservation est annulée.");
      }
      router.refresh();
    });
  }

  if (etat === "SANS_RESERVATION") return null;

  if (!connecte) {
    return (
      <p className="text-text-2 text-sm">
        <Link href="/mon-espace" className="font-semibold underline">
          Connectez-vous à votre espace
        </Link>{" "}
        pour réserver votre place.
      </p>
    );
  }

  if (statut !== "AUCUN") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-heading text-sm font-semibold">
          {statut === "WAITLISTED" ? "Vous êtes en liste d'attente" : "Votre place est réservée"}
        </span>
        <button
          type="button"
          disabled={enCours}
          onClick={() => appeler("DELETE")}
          className="border-danger-text text-danger-text hover:bg-danger-soft transition-tout inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          <X aria-hidden size={15} strokeWidth={2.2} />
          {enCours ? "…" : "Annuler ma réservation"}
        </button>
        {message && <p className="text-text-3 basis-full text-sm">{message}</p>}
        {erreur && <p className="text-danger-text basis-full text-sm">{erreur}</p>}
      </div>
    );
  }

  const ferme = etat === "CLOTUREE" || etat === "COMPLETE";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={enCours || ferme}
        onClick={() => appeler("POST")}
        className="bg-primary text-primary-text hover:bg-primary-hover transition-tout inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow-sm hover:shadow-md disabled:opacity-60"
      >
        {/* L'icône dit l'issue : une place prise, une file d'attente, ou une
            porte fermée. Trois états qui se lisaient jusqu'ici au texte seul. */}
        {ferme ? (
          <Lock aria-hidden size={15} strokeWidth={2.2} />
        ) : etat === "LISTE_ATTENTE" ? (
          <Hourglass aria-hidden size={15} strokeWidth={2.2} />
        ) : (
          <TicketCheck aria-hidden size={15} strokeWidth={2.2} />
        )}
        {ferme
          ? etat === "CLOTUREE"
            ? "Réservations closes"
            : "Session complète"
          : etat === "LISTE_ATTENTE"
            ? "Rejoindre la liste d'attente"
            : "Réserver ma place"}
      </button>
      {message && <p className="text-text-3 basis-full text-sm">{message}</p>}
      {erreur && <p className="text-danger-text basis-full text-sm">{erreur}</p>}
    </div>
  );
}
