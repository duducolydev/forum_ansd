"use client";

import { useActionState, useState } from "react";
import { ROLE_LABELS } from "@/lib/permissions";
import { enregistrerRoleAction, type EtatAction } from "../actions";
import { CATALOGUE } from "../permissions-catalogue";
import { Save } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";

const etatInitial: EtatAction = {};

export interface RoleAffiche {
  id: string;
  name: string;
  permissions: string[];
  comptes: number;
  comptesActifs: number;
}

export function CarteRole({ role, estMonRole }: { role: RoleAffiche; estMonRole: boolean }) {
  const [etat, action, enCours] = useActionState(
    enregistrerRoleAction.bind(null, role.id),
    etatInitial,
  );
  const [cochees, setCochees] = useState<Set<string>>(new Set(role.permissions));

  function basculer(cle: string, coche: boolean) {
    setCochees((precedentes) => {
      const copie = new Set(precedentes);
      if (coche) copie.add(cle);
      else copie.delete(cle);
      return copie;
    });
  }

  return (
    <details className="border-border bg-surface rounded-xl border p-5">
      <summary className="cursor-pointer">
        <span className="text-heading text-sm font-semibold">
          {ROLE_LABELS[role.name] ?? role.name}
        </span>
        <span className="text-text-3 ml-3 text-xs">
          {cochees.size} droit{cochees.size > 1 ? "s" : ""} · {role.comptesActifs} compte
          {role.comptesActifs > 1 ? "s" : ""} actif{role.comptesActifs > 1 ? "s" : ""}
          {estMonRole ? " · votre rôle" : ""}
        </span>
      </summary>

      {estMonRole ? (
        <p className="text-text-2 mt-3 text-sm">
          C&apos;est votre propre rôle. Ses droits ne se modifient pas depuis ici : le changement
          s&apos;appliquerait aussitôt et pourrait vous fermer cet écran en cours de route. Passez
          par un autre compte administrateur.
        </p>
      ) : (
        <form action={action} className="mt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {CATALOGUE.map((groupe) => (
              <fieldset key={groupe.titre} className="border-border rounded-lg border p-3">
                <legend className="text-text-3 px-1 text-xs font-semibold">{groupe.titre}</legend>
                <div className="flex flex-col gap-1.5">
                  {groupe.permissions.map((permission) => (
                    <label
                      key={permission.cle}
                      htmlFor={`${role.id}-${permission.cle}`}
                      className="text-text-2 flex items-start gap-2 text-sm"
                    >
                      <input
                        id={`${role.id}-${permission.cle}`}
                        type="checkbox"
                        name="permission"
                        value={permission.cle}
                        checked={cochees.has(permission.cle)}
                        onChange={(event) => basculer(permission.cle, event.target.checked)}
                        className="mt-1"
                      />
                      <span>
                        {permission.label}
                        {permission.note && (
                          <span className="text-text-3 block text-xs">{permission.note}</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>

          <p className="text-text-3 mt-3 text-xs">
            Les droits sont résolus à la connexion : les {role.comptesActifs} titulaire
            {role.comptesActifs > 1 ? "s" : ""} de ce rôle verront le changement à leur prochaine
            connexion, pas immédiatement.
          </p>

          <Bouton ton="principal" icone={Save} type="submit" disabled={enCours} className="mt-3">
            {enCours ? "Enregistrement…" : "Enregistrer les droits"}
          </Bouton>
          {etat.erreur && <p className="text-danger-text mt-2 text-sm">{etat.erreur}</p>}
          {etat.avis && <p className="text-accent-text mt-2 text-sm">{etat.avis}</p>}
        </form>
      )}
    </details>
  );
}
