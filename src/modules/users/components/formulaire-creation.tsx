"use client";

import { useActionState } from "react";
import { ROLE_LABELS } from "@/lib/permissions";
import { creerUtilisateurAction, type EtatAction } from "../actions";
import { GenerateurMotDePasse } from "./generateur-mdp";
import { Plus } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";

const etatInitial: EtatAction = {};

export function FormulaireCreation({ roles }: { roles: { id: string; name: string }[] }) {
  const [etat, action, enCours] = useActionState(creerUtilisateurAction, etatInitial);

  return (
    <details className="border-border bg-surface mb-5 rounded-xl border p-5">
      <summary className="text-heading cursor-pointer text-sm font-semibold">
        Créer un compte
      </summary>
      <form action={action} className="mt-4 flex flex-col gap-3.5">
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="creation-name" className="text-text-3 text-xs font-semibold">
              Nom et prénom
            </label>
            <input
              id="creation-name"
              name="name"
              required
              className="border-border bg-bg text-text rounded-lg border px-3 py-2.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="creation-email" className="text-text-3 text-xs font-semibold">
              Adresse électronique
            </label>
            <input
              id="creation-email"
              name="email"
              type="email"
              required
              className="border-border bg-bg text-text rounded-lg border px-3 py-2.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="creation-role" className="text-text-3 text-xs font-semibold">
              Rôle
            </label>
            <select
              id="creation-role"
              name="roleId"
              required
              defaultValue=""
              className="border-border bg-bg text-text rounded-lg border px-3 py-2.5 text-sm"
            >
              <option value="" disabled>
                Choisir…
              </option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {ROLE_LABELS[role.name] ?? role.name}
                </option>
              ))}
            </select>
          </div>
          <GenerateurMotDePasse id="creation-password" label="Mot de passe initial" />
        </div>

        <p className="text-text-3 text-xs">
          Notez le mot de passe avant d&apos;enregistrer : il n&apos;est plus affiché ensuite. Les
          rôles Super Administrateur et Administrateur Forum devront enrôler un second facteur à
          leur première connexion.
        </p>

        {etat.erreur && <p className="text-danger-text text-sm">{etat.erreur}</p>}
        {etat.avis && <p className="text-accent-text text-sm">{etat.avis}</p>}

        <div>
          <Bouton ton="principal" icone={Plus} type="submit" disabled={enCours}>
            {enCours ? "Création…" : "Créer le compte"}
          </Bouton>
        </div>
      </form>
    </details>
  );
}
