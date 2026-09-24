"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Trash2 } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { envoyerNewsletterAction, supprimerNewsletterAction } from "../actions";

/**
 * Envoi et suppression d'une newsletter (§34).
 *
 * L'envoi demande une confirmation nommant la newsletter, comme une
 * suppression : c'est le seul acte irréversible du module. Mille messages
 * partis ne se rappellent pas, et le bouton disparaît ensuite.
 */
export function EnvoiNewsletter({
  id,
  titre,
  publiee,
  envoyeeLe,
  destinataires,
}: {
  id: string;
  titre: string;
  publiee: boolean;
  envoyeeLe: string | null;
  destinataires: number;
}) {
  const router = useRouter();
  const [confirme, setConfirme] = useState(false);
  const [confirmeSuppression, setConfirmeSuppression] = useState(false);
  const [message, setMessage] = useState<{ texte: string; erreur: boolean } | null>(null);
  const [enCours, startTransition] = useTransition();

  if (envoyeeLe) {
    return (
      <div className="border-border bg-surface rounded-xl border p-6">
        <h3 className="mb-1 text-lg">Envoi</h3>
        <p className="text-text-2 text-sm">
          Envoyée le <strong>{envoyeeLe}</strong> à {destinataires} destinataire(s). Un second envoi
          n&apos;est pas possible : les messages déjà partis ne se rappellent pas.
        </p>
        <p className="text-text-3 mt-2 text-sm">
          Les corrections faites ici restent visibles sur le site, où mènent les liens des e-mails.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="border-border bg-surface rounded-xl border p-6">
        <h3 className="mb-1 text-lg">Envoyer aux participants</h3>
        <p className="text-text-2 mb-3 text-sm">
          Le message part vers les inscrits et les confirmés, hors désistés et annulés. Il contient
          le titre, le chapô et un lien vers cette page — les images et la mise en forme vivent sur
          le site, où elles s&apos;affichent correctement.
        </p>

        {!publiee ? (
          <p className="text-warn-text bg-warn-soft rounded-lg px-3 py-2.5 text-sm">
            Publiez d&apos;abord la newsletter : le message porte un lien vers sa page, qui serait
            introuvable.
          </p>
        ) : confirme ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-text text-sm">
              Envoyer <strong>{titre}</strong> à tous les participants ?
            </span>
            <Bouton
              ton="principal"
              taille="petit"
              icone={Send}
              disabled={enCours}
              onClick={() =>
                startTransition(async () => {
                  const resultat = await envoyerNewsletterAction(id, {});
                  setMessage(
                    resultat.erreur
                      ? { texte: resultat.erreur, erreur: true }
                      : { texte: resultat.avis ?? "Envoi lancé.", erreur: false },
                  );
                  setConfirme(false);
                  router.refresh();
                })
              }
            >
              {enCours ? "Envoi…" : "Oui, envoyer"}
            </Bouton>
            <Bouton
              ton="discret"
              taille="petit"
              disabled={enCours}
              onClick={() => setConfirme(false)}
            >
              Annuler
            </Bouton>
          </div>
        ) : (
          <Bouton ton="principal" icone={Send} onClick={() => setConfirme(true)}>
            Envoyer aux participants
          </Bouton>
        )}

        {message && (
          <p
            role="status"
            className={`mt-3 text-sm ${message.erreur ? "text-danger-text" : "text-accent-text"}`}
          >
            {message.texte}
          </p>
        )}
      </div>

      <div className="border-border bg-surface rounded-xl border p-6">
        <h3 className="mb-1 text-lg">Supprimer</h3>
        <p className="text-text-2 mb-3 text-sm">
          Possible tant que la newsletter n&apos;a pas été envoyée. Ses images sont supprimées avec
          elle : plus rien ne les désignerait.
        </p>
        {confirmeSuppression ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-text text-sm">
              Supprimer définitivement <strong>{titre}</strong> ?
            </span>
            <Bouton
              ton="danger"
              taille="petit"
              icone={Trash2}
              disabled={enCours}
              onClick={() =>
                startTransition(async () => {
                  const resultat = await supprimerNewsletterAction(id, {});
                  if (resultat.erreur) {
                    setMessage({ texte: resultat.erreur, erreur: true });
                    setConfirmeSuppression(false);
                    return;
                  }
                  router.push("/admin/newsletters");
                })
              }
            >
              {enCours ? "Suppression…" : "Oui, supprimer"}
            </Bouton>
            <Bouton
              ton="discret"
              taille="petit"
              disabled={enCours}
              onClick={() => setConfirmeSuppression(false)}
            >
              Annuler
            </Bouton>
          </div>
        ) : (
          <Bouton
            ton="danger"
            taille="petit"
            icone={Trash2}
            onClick={() => setConfirmeSuppression(true)}
          >
            Supprimer cette newsletter
          </Bouton>
        )}
      </div>
    </div>
  );
}
