"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Trash2 } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { auClicConfirme } from "@/components/ui/confirmer";
import type { ActionState } from "../actions";
import {
  modifierRattachementAction,
  rattacherSessionAction,
  retirerSessionAction,
} from "../rattachement-actions";
import {
  ROLES_SESSION,
  STATUTS_CONFIRMATION,
  type RoleSession,
  type StatutConfirmation,
} from "../constantes";

const CHAMP = "border-border bg-bg text-text w-full rounded-lg border px-3 py-2 text-sm";
const ETIQUETTE = "text-text-3 text-xs font-semibold";

export interface RattachementVue {
  sessionId: string;
  titre: string;
  quand: string;
  role: RoleSession;
  statut: StatutConfirmation;
}

export interface SessionChoix {
  id: string;
  titre: string;
  quand: string;
}

function LigneRattachement({
  speakerId,
  rattachement,
  signaler,
}: {
  speakerId: string;
  rattachement: RattachementVue;
  signaler: (retour: ActionState) => void;
}) {
  const [role, setRole] = useState<RoleSession>(rattachement.role);
  const [statut, setStatut] = useState<StatutConfirmation>(rattachement.statut);
  const [enCours, startTransition] = useTransition();
  const router = useRouter();

  /*
   * Enregistré au changement, sans bouton : un statut qu'on croit modifié parce
   * que la liste l'affiche, mais jamais envoyé, fausserait le suivi des
   * confirmations. En cas de refus, la liste revient à ce qui est en base.
   */
  function enregistrer(prochainRole: RoleSession, prochainStatut: StatutConfirmation) {
    const precedent = { role, statut };
    setRole(prochainRole);
    setStatut(prochainStatut);
    startTransition(async () => {
      const resultat = await modifierRattachementAction(
        speakerId,
        rattachement.sessionId,
        prochainRole,
        prochainStatut,
      );
      if (resultat.error) {
        setRole(precedent.role);
        setStatut(precedent.statut);
      } else {
        router.refresh();
      }
      signaler(resultat);
    });
  }

  function retirer() {
    startTransition(async () => {
      const resultat = await retirerSessionAction(speakerId, rattachement.sessionId);
      signaler(resultat);
      if (!resultat.error) router.refresh();
    });
  }

  return (
    <li
      data-testid="rattachement-session"
      data-session-id={rattachement.sessionId}
      className="border-border flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-end"
    >
      <span className="min-w-0 flex-1 text-sm">
        <span className="text-heading block font-medium">{rattachement.titre}</span>
        <span className="text-text-3 text-xs">{rattachement.quand}</span>
      </span>

      <select
        aria-label={`Rôle — ${rattachement.titre}`}
        value={role}
        disabled={enCours}
        onChange={(evenement) => enregistrer(evenement.target.value as RoleSession, statut)}
        className={`${CHAMP} md:w-52`}
      >
        {Object.entries(ROLES_SESSION).map(([cle, libelle]) => (
          <option key={cle} value={cle}>
            {libelle}
          </option>
        ))}
      </select>

      <select
        aria-label={`Statut — ${rattachement.titre}`}
        value={statut}
        disabled={enCours}
        onChange={(evenement) => enregistrer(role, evenement.target.value as StatutConfirmation)}
        className={`${CHAMP} md:w-40`}
      >
        {Object.entries(STATUTS_CONFIRMATION).map(([cle, libelle]) => (
          <option key={cle} value={cle}>
            {libelle}
          </option>
        ))}
      </select>

      <Bouton
        ton="discret"
        taille="petit"
        icone={Trash2}
        type="button"
        disabled={enCours}
        onClick={auClicConfirme(
          {
            titre: "Retirer l'intervenant de cette session ?",
            texte: `Il n'apparaîtra plus dans « ${rattachement.titre} ». Sa présentation en sort aussi si elle n'y est qu'en brouillon.`,
            confirmer: "Retirer",
            ton: "danger",
          },
          retirer,
        )}
      >
        Retirer
      </Bouton>
    </li>
  );
}

/**
 * Sessions d'un intervenant, avec son rôle et son statut de confirmation dans
 * chacune (brief §5.8).
 *
 * Cet écran manquait : seul le jeu de démonstration rattachait des intervenants
 * aux sessions. Un intervenant créé en BackOffice restait donc hors programme,
 * et sa présentation hors des contributions (§15.9).
 */
export function SessionsIntervenant({
  speakerId,
  rattachements,
  sessions,
  aPresentation,
}: {
  speakerId: string;
  rattachements: RattachementVue[];
  sessions: SessionChoix[];
  aPresentation: boolean;
}) {
  const [retour, setRetour] = useState<ActionState>({});
  const [sessionChoisie, setSessionChoisie] = useState("");
  const [role, setRole] = useState<RoleSession>("PANELIST");
  const [enCours, startTransition] = useTransition();
  const router = useRouter();

  const proposables = sessions.filter(
    (session) => !rattachements.some((rattachement) => rattachement.sessionId === session.id),
  );

  function ajouter() {
    setRetour({});
    startTransition(async () => {
      const resultat = await rattacherSessionAction(speakerId, sessionChoisie, role);
      setRetour(resultat);
      if (!resultat.error) {
        setSessionChoisie("");
        router.refresh();
      }
    });
  }

  return (
    <section
      aria-labelledby="titre-sessions-intervenant"
      className="border-border bg-surface rounded-xl border p-5"
    >
      <h3 id="titre-sessions-intervenant" className="text-heading text-sm font-semibold">
        Sessions de l&apos;intervenant
      </h3>
      <p className="text-text-3 mt-1 text-xs">
        Rôle et statut de confirmation, session par session. Enregistrés dès qu&apos;on les change ;
        l&apos;intervenant les voit dans son espace, sans pouvoir les modifier.
      </p>

      {aPresentation && rattachements.length === 0 && (
        <p className="bg-blue-soft text-blue-text mt-3 rounded-lg px-3 py-2 text-sm">
          Sa présentation est déposée, mais ne figure dans aucune contribution : rattachez-le à une
          session pour qu&apos;elle y apparaisse, en brouillon.
        </p>
      )}

      {rattachements.length === 0 ? (
        <p className="text-text-3 mt-3 text-sm">Rattaché à aucune session.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {rattachements.map((rattachement) => (
            <LigneRattachement
              key={rattachement.sessionId}
              speakerId={speakerId}
              rattachement={rattachement}
              signaler={setRetour}
            />
          ))}
        </ul>
      )}

      {proposables.length > 0 && (
        <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-end">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label htmlFor="session-a-ajouter" className={ETIQUETTE}>
              Session à ajouter
            </label>
            <select
              id="session-a-ajouter"
              value={sessionChoisie}
              onChange={(evenement) => setSessionChoisie(evenement.target.value)}
              className={CHAMP}
            >
              <option value="">Choisir une session…</option>
              {proposables.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.titre} — {session.quand}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="role-a-ajouter" className={ETIQUETTE}>
              Rôle dans la session
            </label>
            <select
              id="role-a-ajouter"
              value={role}
              onChange={(evenement) => setRole(evenement.target.value as RoleSession)}
              className={`${CHAMP} md:w-52`}
            >
              {Object.entries(ROLES_SESSION).map(([cle, libelle]) => (
                <option key={cle} value={cle}>
                  {libelle}
                </option>
              ))}
            </select>
          </div>
          <Bouton
            ton="principal"
            icone={Plus}
            type="button"
            disabled={!sessionChoisie || enCours}
            onClick={ajouter}
          >
            Ajouter à la session
          </Bouton>
        </div>
      )}

      {retour.error && (
        <p role="status" className="text-danger-text mt-3 text-sm">
          {retour.error}
        </p>
      )}
      {retour.message && !retour.error && (
        <p role="status" className="text-accent-text mt-3 flex items-start gap-1.5 text-sm">
          <Check aria-hidden size={15} className="mt-0.5 shrink-0" />
          {retour.message}
        </p>
      )}
    </section>
  );
}
