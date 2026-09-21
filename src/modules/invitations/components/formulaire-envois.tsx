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
 * Un seul jeu de filtres pour les deux : une campagne se lance catégorie par
 * catégorie ou pays par pays, ce qui est le seul moyen de rester sous le quota
 * quotidien de la boîte d'envoi.
 *
 * La campagne demande **confirmation** : un millier de courriels partis ne se
 * rappellent pas. La relance, elle, est bornée par le code (trois par personne).
 */
export function FormulaireEnvois({
  categories,
  enAttente,
  envoisParMinute,
}: {
  categories: { id: string; labelFr: string }[];
  /** Invitations jamais envoyées, toutes catégories confondues. */
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

  // Gestionnaire volontairement synchrone : un `onClick` déclaré `async` renvoie
  // une promesse que React ignore.
  function envoyerLesEnAttente() {
    if (!formulaire.current) return;
    const donnees = new FormData(formulaire.current);
    const categorie = categories.find((c) => c.id === donnees.get("categoryId"))?.labelFr;
    const pays = String(donnees.get("country") ?? "").trim();
    const cible = [categorie, pays].filter(Boolean).join(" · ");

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
      <div className="flex flex-col gap-1">
        <label htmlFor="envois-category" className="text-text-3 text-xs font-semibold">
          Catégorie
        </label>
        <select
          id="envois-category"
          name="categoryId"
          className="border-border bg-surface text-text rounded-lg border px-3 py-2 text-sm"
        >
          <option value="">Toutes</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.labelFr}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="envois-country" className="text-text-3 text-xs font-semibold">
          Pays
        </label>
        <input
          id="envois-country"
          name="country"
          placeholder="Tous"
          className="border-border bg-surface text-text rounded-lg border px-3 py-2 text-sm"
        />
      </div>

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
