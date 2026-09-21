"use client";

import { useActionState } from "react";
import { ROLE_LABELS } from "@/lib/permissions";
import {
  deverrouillerAction,
  modifierUtilisateurAction,
  reinitialiserMotDePasseAction,
  type EtatAction,
} from "../actions";
import { GenerateurMotDePasse } from "./generateur-mdp";
import { KeyRound, LockOpen, Save } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";

const etatInitial: EtatAction = {};

export interface UtilisateurAffiche {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  /** Le rôle impose une validation par e-mail à chaque connexion (PLAN.md §23). */
  exigeDeuxFacteurs: boolean;
  lastLoginAt: Date | null;
  lockedUntil: Date | null;
  roleId: string;
  roleName: string;
}

function Pastille({ ton, children }: { ton: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-block rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${ton}`}
    >
      {children}
    </span>
  );
}

function dateCourte(valeur: Date | null): string {
  if (!valeur) return "jamais";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(
    valeur,
  );
}

export function CarteUtilisateur({
  utilisateur,
  roles,
  estMoi,
}: {
  utilisateur: UtilisateurAffiche;
  roles: { id: string; name: string }[];
  estMoi: boolean;
}) {
  const [etatModif, actionModif, modifEnCours] = useActionState(
    modifierUtilisateurAction.bind(null, utilisateur.id),
    etatInitial,
  );
  const [etatMdp, actionMdp, mdpEnCours] = useActionState(
    reinitialiserMotDePasseAction.bind(null, utilisateur.id),
    etatInitial,
  );
  const [etatVerrou, actionVerrou, verrouEnCours] = useActionState(
    deverrouillerAction.bind(null, utilisateur.id),
    etatInitial,
  );

  const verrouille = utilisateur.lockedUntil !== null && utilisateur.lockedUntil > new Date();

  return (
    <div data-testid="carte-utilisateur" className="border-border bg-surface rounded-xl border p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-heading font-semibold">{utilisateur.name}</span>
        <span className="text-text-3 text-sm">{utilisateur.email}</span>
        <span className="flex-1" />
        {estMoi && <Pastille ton="bg-blue-soft text-blue-text">Vous</Pastille>}
        {utilisateur.isActive ? (
          <Pastille ton="bg-accent-soft text-accent-text">Actif</Pastille>
        ) : (
          <Pastille ton="bg-danger-soft text-danger-text">Désactivé</Pastille>
        )}
        {utilisateur.exigeDeuxFacteurs && (
          <Pastille ton="bg-gold-soft text-gold-text">Code par e-mail</Pastille>
        )}
        {verrouille && <Pastille ton="bg-danger-soft text-danger-text">Verrouillé</Pastille>}
      </div>

      <p className="text-text-3 mb-4 text-xs">
        Dernière connexion : {dateCourte(utilisateur.lastLoginAt)}
        {verrouille && ` — verrouillé jusqu'à ${dateCourte(utilisateur.lockedUntil)}`}
      </p>

      <form action={actionModif} className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
          <label htmlFor={`nom-${utilisateur.id}`} className="text-text-3 text-xs font-semibold">
            Nom
          </label>
          <input
            id={`nom-${utilisateur.id}`}
            name="name"
            defaultValue={utilisateur.name}
            className="border-border bg-bg text-text rounded-lg border px-3 py-2.5 text-sm"
          />
        </div>
        <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
          <label htmlFor={`role-${utilisateur.id}`} className="text-text-3 text-xs font-semibold">
            Rôle
          </label>
          <select
            id={`role-${utilisateur.id}`}
            name="roleId"
            defaultValue={utilisateur.roleId}
            disabled={estMoi}
            className="border-border bg-bg text-text rounded-lg border px-3 py-2.5 text-sm disabled:opacity-60"
          >
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {ROLE_LABELS[role.name] ?? role.name}
              </option>
            ))}
          </select>
          {/* Le champ désactivé n'est pas sérialisé : sans ce doublon, enregistrer
              son propre compte enverrait un rôle vide et serait refusé. */}
          {estMoi && <input type="hidden" name="roleId" value={utilisateur.roleId} />}
        </div>
        <label className="text-text-2 flex items-center gap-2 py-2.5 text-sm">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={utilisateur.isActive}
            disabled={estMoi}
          />
          Compte actif
        </label>
        <Bouton ton="principal" icone={Save} type="submit" disabled={modifEnCours}>
          {modifEnCours ? "Enregistrement…" : "Enregistrer"}
        </Bouton>
      </form>
      {etatModif.erreur && <p className="text-danger-text mb-3 text-sm">{etatModif.erreur}</p>}
      {etatModif.avis && <p className="text-accent-text mb-3 text-sm">{etatModif.avis}</p>}

      <div className="border-border flex flex-wrap items-end gap-3 border-t pt-4">
        <form action={actionMdp} className="flex min-w-[280px] flex-1 items-end gap-3">
          <div className="flex-1">
            <GenerateurMotDePasse id={`mdp-${utilisateur.id}`} label="Nouveau mot de passe" />
          </div>
          <Bouton ton="secondaire" icone={KeyRound} type="submit" disabled={mdpEnCours}>
            {mdpEnCours ? "…" : "Remplacer"}
          </Bouton>
        </form>

        {verrouille && (
          <form action={actionVerrou}>
            <Bouton
              ton="secondaire"
              icone={LockOpen}
              type="submit"
              disabled={verrouEnCours}
              titre="Lever le verrou des quinze minutes sans attendre son expiration"
            >
              {verrouEnCours ? "…" : "Déverrouiller"}
            </Bouton>
          </form>
        )}
      </div>

      {(etatMdp.erreur ?? etatVerrou.erreur) && (
        <p className="text-danger-text mt-2 text-sm">{etatMdp.erreur ?? etatVerrou.erreur}</p>
      )}
      {(etatMdp.avis ?? etatVerrou.avis) && (
        <p className="text-accent-text mt-2 text-sm">{etatMdp.avis ?? etatVerrou.avis}</p>
      )}
    </div>
  );
}
