"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MailWarning, Megaphone } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { auClicConfirme } from "@/components/ui/confirmer";
import { annoncerChangementsAction } from "../actions";

/**
 * Encadré « Changements à annoncer » (13 novembre 2026).
 *
 * Enregistrer une session n'écrit à personne : l'écran liste ce qui a bougé
 * depuis le dernier message parti, et **un bouton** décide du départ. Un envoi
 * d'office aurait écrit trois fois à deux cents personnes pour un horaire
 * corrigé en trois essais, et aurait fait partir la correction d'une coquille
 * au milieu d'une refonte.
 *
 * Les changements affichés sont ceux calculés par le serveur, en français :
 * chaque destinataire recevra les siens dans sa langue.
 */
export function AnnonceChangements({
  id,
  changements,
  destinataires,
}: {
  id: string;
  /** Lignes « Horaire : 09:00 - 10:30 → 11:00 - 12:30 », déjà rédigées. */
  changements: string[];
  destinataires: number;
}) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();
  const router = useRouter();

  // Rien à annoncer : l'encadré disparaît plutôt que d'afficher un bouton
  // désactivé, qui laisserait croire à un envoi empêché.
  if (changements.length === 0) return null;

  function annoncer() {
    setErreur(null);
    setMessage(null);
    startTransition(async () => {
      const resultat = await annoncerChangementsAction(id);
      if (resultat.error) setErreur(resultat.error);
      else {
        setMessage(resultat.message ?? null);
        router.refresh();
      }
    });
  }

  return (
    <section className="border-warn-text/40 bg-warn-soft rounded-xl border p-5">
      <h3 className="text-heading mb-1 flex items-center gap-2 text-sm font-semibold">
        <MailWarning aria-hidden className="size-4" />
        Changements à annoncer
      </h3>
      <p className="text-text-2 mb-3 text-xs">
        Depuis le dernier message envoyé. Tant que vous ne pressez pas le bouton, les inscrits et
        les intervenants ne savent rien de ces changements.
      </p>

      <ul className="text-heading mb-4 flex list-disc flex-col gap-1 pl-5 text-sm">
        {changements.map((ligne) => (
          <li key={ligne}>{ligne}</li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <Bouton
          ton="principal"
          icone={Megaphone}
          disabled={enCours || destinataires === 0}
          onClick={auClicConfirme(
            {
              titre: "Prévenir les inscrits et les intervenants ?",
              texte: `${destinataires} personne(s) recevront un e-mail listant ces ${changements.length} changement(s). L'envoi est immédiat et ne se rattrape pas.`,
              confirmer: "Envoyer l'annonce",
            },
            annoncer,
          )}
        >
          {enCours ? "Envoi…" : `Prévenir les ${destinataires} inscrit(s) et intervenant(s)`}
        </Bouton>
        {destinataires === 0 && (
          <span className="text-text-3 text-xs">
            Personne n&apos;est inscrit à cette session et aucun intervenant joignable n&apos;y est
            rattaché : il n&apos;y a personne à prévenir.
          </span>
        )}
      </div>

      {erreur && <p className="text-danger-text mt-2 text-sm">{erreur}</p>}
      {message && (
        <p role="status" className="text-text-2 mt-2 text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
