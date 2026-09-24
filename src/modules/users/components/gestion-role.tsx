"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { renommerRoleAction, supprimerRoleAction, type EtatAction } from "../actions";

const etatInitial: EtatAction = {};

/**
 * Renommer ou supprimer un rôle **créé en BackOffice** (§30).
 *
 * Absent des rôles du brief, dont le nom est comparé dans le code : cette
 * carte n'est rendue que pour les autres. Ce n'est pas seulement une question
 * d'affichage — le service refuse les deux opérations de son côté, et ce filtre
 * évite de proposer un geste qui serait rejeté.
 *
 * Seul le **libellé** se change. Le nom technique est figé à la création : il
 * est inscrit sur les comptes qui portent le rôle et dans le journal d'audit,
 * et le modifier rendrait ces traces illisibles pour un gain d'apparence.
 */
export function GestionRole({
  roleId,
  label,
  comptes,
}: {
  roleId: string;
  label: string;
  comptes: number;
}) {
  const router = useRouter();
  const [etat, action, enCours] = useActionState(
    renommerRoleAction.bind(null, roleId),
    etatInitial,
  );
  const [confirme, setConfirme] = useState(false);
  const [erreurSuppression, setErreurSuppression] = useState<string | null>(null);
  const [suppressionEnCours, startTransition] = useTransition();

  return (
    <div className="border-border mt-4 flex flex-col gap-3 border-t pt-4">
      <form action={action} className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-[240px] flex-1 flex-col gap-1.5">
          <label htmlFor={`${roleId}-label`} className="text-heading text-xs font-semibold">
            Libellé
          </label>
          <input
            id={`${roleId}-label`}
            name="label"
            defaultValue={label}
            required
            className="border-border bg-surface text-text w-full rounded-lg border px-3 py-2"
          />
        </div>
        <Bouton ton="secondaire" taille="petit" icone={Pencil} type="submit" disabled={enCours}>
          {enCours ? "Enregistrement…" : "Renommer"}
        </Bouton>
      </form>

      {etat.erreur && <p className="text-danger-text text-sm">{etat.erreur}</p>}
      {etat.avis && <p className="text-accent-text text-sm">{etat.avis}</p>}

      {comptes > 0 ? (
        <p className="text-text-3 text-xs">
          {comptes} compte(s) portent ce rôle : il ne peut pas être supprimé tant qu&apos;ils ne
          sont pas rattachés ailleurs.
        </p>
      ) : confirme ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-text text-sm">
            Supprimer définitivement <strong>{label}</strong> ?
          </span>
          <Bouton
            ton="danger"
            taille="petit"
            icone={Trash2}
            disabled={suppressionEnCours}
            onClick={() =>
              startTransition(async () => {
                const resultat = await supprimerRoleAction(roleId, {});
                if (resultat.erreur) {
                  setErreurSuppression(resultat.erreur);
                  setConfirme(false);
                  return;
                }
                router.refresh();
              })
            }
          >
            {suppressionEnCours ? "Suppression…" : "Oui, supprimer"}
          </Bouton>
          <Bouton
            ton="discret"
            taille="petit"
            disabled={suppressionEnCours}
            onClick={() => setConfirme(false)}
          >
            Annuler
          </Bouton>
        </div>
      ) : (
        <div>
          <Bouton ton="danger" taille="petit" icone={Trash2} onClick={() => setConfirme(true)}>
            Supprimer ce rôle
          </Bouton>
        </div>
      )}

      {erreurSuppression && <p className="text-danger-text text-sm">{erreurSuppression}</p>}
    </div>
  );
}
