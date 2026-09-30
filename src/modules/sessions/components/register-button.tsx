"use client";
import { selon, type Langue } from "@/lib/langue";
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
  locale,
}: {
  sessionId: string;
  etat: EtatSession;
  statut: StatutParticipant;
  connecte: boolean;
  locale: Langue;
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
        setMessage(
          selon(locale, {
            fr: `Vous êtes en liste d'attente, position ${corps.position}.`,
            en: `You are on the waiting list, position ${corps.position}.`,
            pt: `Está na lista de espera, posição ${corps.position}.`,
          }),
        );
      } else if (methode === "POST") {
        setMessage(
          selon(locale, {
            fr: "Votre place est réservée.",
            en: "Your seat is booked.",
            pt: "O seu lugar está reservado.",
          }),
        );
      } else {
        setMessage(
          selon(locale, {
            fr: "Votre réservation est annulée.",
            en: "Your booking is cancelled.",
            pt: "A sua reserva foi cancelada.",
          }),
        );
      }
      router.refresh();
    });
  }

  if (etat === "SANS_RESERVATION") return null;

  if (!connecte) {
    return (
      <p className="text-text-2 text-sm">
        <Link href="/mon-espace" className="font-semibold underline">
          {selon(locale, {
            fr: "Connectez-vous à votre espace",
            en: "Sign in to your space",
            pt: "Entre no seu espaço",
          })}
        </Link>{" "}
        {selon(locale, {
          fr: "pour réserver votre place.",
          en: "to book your seat.",
          pt: "para reservar o seu lugar.",
        })}
      </p>
    );
  }

  if (statut !== "AUCUN") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-heading text-sm font-semibold">
          {statut === "WAITLISTED"
            ? selon(locale, {
                fr: "Vous êtes en liste d'attente",
                en: "You are on the waiting list",
                pt: "Está na lista de espera",
              })
            : selon(locale, {
                fr: "Votre place est réservée",
                en: "Your seat is booked",
                pt: "O seu lugar está reservado",
              })}
        </span>
        <button
          type="button"
          disabled={enCours}
          onClick={() => appeler("DELETE")}
          className="border-danger-text text-danger-text hover:bg-danger-soft transition-tout inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          <X aria-hidden size={15} strokeWidth={2.2} />
          {enCours
            ? "…"
            : selon(locale, {
                fr: "Annuler ma réservation",
                en: "Cancel my booking",
                pt: "Cancelar a minha reserva",
              })}
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
            ? selon(locale, {
                fr: "Réservations closes",
                en: "Bookings closed",
                pt: "Reservas encerradas",
              })
            : selon(locale, { fr: "Session complète", en: "Session full", pt: "Sessão esgotada" })
          : etat === "LISTE_ATTENTE"
            ? selon(locale, {
                fr: "Rejoindre la liste d'attente",
                en: "Join the waiting list",
                pt: "Entrar na lista de espera",
              })
            : selon(locale, {
                fr: "Réserver ma place",
                en: "Book my seat",
                pt: "Reservar o meu lugar",
              })}
      </button>
      {message && <p className="text-text-3 basis-full text-sm">{message}</p>}
      {erreur && <p className="text-danger-text basis-full text-sm">{erreur}</p>}
    </div>
  );
}
