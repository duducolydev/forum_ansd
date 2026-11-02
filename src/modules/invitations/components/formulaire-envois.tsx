"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { MailPlus, Send } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { confirmer } from "@/components/ui/confirmer";
import { sendPendingInvitationsAction, sendRemindersAction, type ActionState } from "../actions";

const etatInitial: ActionState = {};

/**
 * Envois de la page Invitations (PLAN.md §22) : la campagne et les relances.
 *
 * Un seul jeu de filtres pour les deux, celui de la liste (`InvitationsToolbar`) :
 * une campagne se lance catégorie par catégorie ou pays par pays, ce qui est le
 * seul moyen de rester sous le quota quotidien de la boîte d'envoi. Seuls la
 * catégorie et le pays la ciblent ; la recherche et le statut ne filtrent que
 * l'affichage.
 *
 * La campagne demande **confirmation** : un millier de courriels partis ne se
 * rappellent pas. La relance, elle, est bornée par le code (trois par personne).
 */
export function FormulaireEnvois({
  categoryId,
  categorie,
  country,
  enAttente,
  envoisParMinute,
}: {
  categoryId: string;
  /** Libellé de la catégorie filtrée, pour annoncer la cible. */
  categorie?: string;
  country: string;
  /** Invitations jamais envoyées dans la catégorie et le pays filtrés. */
  enAttente: number;
  envoisParMinute: number;
}) {
  const [etatRelance, actionRelance, relanceEnCours] = useActionState(
    sendRemindersAction,
    etatInitial,
  );
  const formulaire = useRef<HTMLFormElement>(null);
  const [etatCampagne, setEtatCampagne] = useState<ActionState>(etatInitial);
  const [campagneEnCours, lancerCampagne] = useTransition();
  const cible = [categorie, country].filter(Boolean).join(" · ");

  // Gestionnaire volontairement synchrone : un `onClick` déclaré `async` renvoie
  // une promesse que React ignore.
  function envoyerLesEnAttente() {
    if (!formulaire.current) return;
    const donnees = new FormData(formulaire.current);

    void confirmer({
      titre: "Envoyer les invitations en attente ?",
      texte: `Les invitations jamais envoyées${cible ? ` (${cible})` : ""} partiront par courriel, ${envoisParMinute} par minute. Un message envoyé ne se rappelle pas.`,
      confirmer: "Envoyer",
    }).then((accepte) => {
      if (!accepte) return;
      lancerCampagne(async () => {
        setEtatCampagne(await sendPendingInvitationsAction(etatInitial, donnees));
      });
    });
  }

  return (
    <form ref={formulaire} action={actionRelance} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="categoryId" value={categoryId} />
      <input type="hidden" name="country" value={country} />

      <Bouton
        ton="principal"
        icone={MailPlus}
        type="button"
        onClick={envoyerLesEnAttente}
        disabled={campagneEnCours || enAttente === 0}
      >
        {campagneEnCours ? "Envoi…" : `Envoyer les invitations en attente (${enAttente})`}
      </Bouton>

      <Bouton ton="secondaire" icone={Send} type="submit" disabled={relanceEnCours}>
        {relanceEnCours
          ? "Envoi…"
          : "Relancer les non-répondants (3 relances maximum par personne)"}
      </Bouton>

      <p className="text-text-3 w-full text-xs">
        Cible des envois : <b className="text-text-2">{cible || "toutes les invitations"}</b>{" "}
        (catégorie et pays filtrés ci-dessus ; la recherche et le statut ne s&apos;appliquent pas).
        Les envois sont étalés à {envoisParMinute} par minute pour ménager la boîte d&apos;envoi.
        Une boîte ordinaire plafonne souvent à quelques centaines de messages par jour : lancer la
        campagne par catégorie permet de rester sous cette limite.
      </p>

      {(etatCampagne.success ?? etatRelance.success) && (
        <span className="text-accent-text w-full text-sm">
          {etatCampagne.success ?? etatRelance.success}
        </span>
      )}
      {(etatCampagne.error ?? etatRelance.error) && (
        <span className="text-danger-text w-full text-sm">
          {etatCampagne.error ?? etatRelance.error}
        </span>
      )}
    </form>
  );
}
