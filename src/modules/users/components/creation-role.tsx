"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { creerRoleAction, type EtatAction } from "../actions";
import { CATALOGUE } from "../permissions-catalogue";

const etatInitial: EtatAction = {};
const CHAMP = "border-border bg-surface text-text w-full rounded-lg border px-3 py-2.5";

/**
 * Nom technique proposé à partir du libellé (§30).
 *
 * Le même calcul que côté serveur, mais en avance : le nom qui sera
 * réellement enregistré doit être visible **avant** d'enregistrer, sans quoi
 * on découvre « GESTIONNAIRE_H_TELS » une fois le rôle créé. Le service refait
 * la normalisation de son côté — ce champ est une aide à la saisie, jamais une
 * garantie.
 */
function proposerNom(libelle: string): string {
  return libelle
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

/**
 * Création d'un rôle depuis le BackOffice (§30).
 *
 * Repliée par défaut : cet écran sert d'abord à ajuster les droits des rôles
 * existants, et un formulaire de création déployé en permanence au-dessus
 * d'eux ferait passer l'invention d'un rôle pour le geste courant, alors que
 * c'est le rare.
 */
export function CreationRole() {
  const [etat, action, enCours] = useActionState(creerRoleAction, etatInitial);
  const [libelle, setLibelle] = useState("");
  const [nomTouche, setNomTouche] = useState(false);
  const [nom, setNom] = useState("");

  const nomPropose = nomTouche ? nom : proposerNom(libelle);

  return (
    <details className="border-border bg-surface rounded-xl border p-5">
      <summary className="text-heading cursor-pointer text-sm font-semibold">
        Créer un rôle
        <span className="text-text-3 ml-3 text-xs font-normal">
          Pour un besoin que les rôles du brief ne couvrent pas
        </span>
      </summary>

      <form action={action} className="mt-4 flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="role-label" className="text-heading text-sm font-semibold">
              Libellé
            </label>
            <input
              id="role-label"
              name="label"
              required
              value={libelle}
              onChange={(event) => setLibelle(event.target.value)}
              placeholder="Logistique terrain"
              className={CHAMP}
            />
            <span className="text-text-3 text-xs">Le nom lu par les utilisateurs.</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="role-name" className="text-heading text-sm font-semibold">
              Nom technique
            </label>
            <input
              id="role-name"
              name="name"
              required
              value={nomPropose}
              onChange={(event) => {
                setNomTouche(true);
                setNom(event.target.value);
              }}
              className={`${CHAMP} font-mono text-sm`}
            />
            <span className="text-text-3 text-xs">
              Figé après la création : il est inscrit sur les comptes et dans le journal
              d&apos;audit.
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {CATALOGUE.map((groupe) => (
            <fieldset key={groupe.titre} className="border-border rounded-lg border p-3">
              <legend className="text-text-3 px-1 text-xs font-semibold">{groupe.titre}</legend>
              <div className="flex flex-col gap-1.5">
                {groupe.permissions.map((permission) => (
                  <label
                    key={permission.cle}
                    htmlFor={`nouveau-${permission.cle}`}
                    className="text-text-2 flex items-start gap-2 text-sm"
                  >
                    <input
                      id={`nouveau-${permission.cle}`}
                      type="checkbox"
                      name="permission"
                      value={permission.cle}
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

        <p className="text-text-3 text-xs">
          Un rôle doté de « Gérer les comptes et les rôles » exigera un code de connexion par e-mail
          à chaque session, comme les administrateurs du brief.
        </p>

        {etat.erreur && <p className="text-danger-text text-sm">{etat.erreur}</p>}
        {etat.avis && <p className="text-accent-text text-sm">{etat.avis}</p>}

        <div>
          <Bouton ton="principal" icone={Plus} type="submit" disabled={enCours}>
            {enCours ? "Création…" : "Créer le rôle"}
          </Bouton>
        </div>
      </form>
    </details>
  );
}
