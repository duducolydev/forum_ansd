"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { planifierRappelsAction } from "../actions";

export interface PlanAffichable {
  cle: string;
  libelle: string;
  envoiLe: string;
  destinataires: number;
  depasse: boolean;
  dejaProgrammes: number;
}

/**
 * Programmation des rappels J-7 et J-1 (brief §14).
 *
 * Le bouton est **rejouable sans risque** : les personnes ayant déjà reçu un
 * rappel sont écartées, et l'écran dit combien ont été programmées et combien
 * ont été ignorées. C'est ce qui permet de le presser après avoir confirmé
 * vingt inscriptions de plus, sans se demander si on va écrire deux fois aux
 * précédentes.
 */
export function ReminderPlanner({ plans }: { plans: PlanAffichable[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();
  const router = useRouter();

  const aProgrammer = plans.some((plan) => !plan.depasse);

  return (
    <section className="border-border bg-surface rounded-xl border p-5">
      <h3 className="text-heading mb-1 text-sm font-semibold">Rappels avant le Forum</h3>
      <p className="text-text-3 mb-4 text-xs">
        Adressés aux participants confirmés, à 9 h heure de Dakar. Distincts des relances
        d&apos;invitation, qui poursuivent ceux qui ne se sont pas inscrits.
      </p>

      <ul className="mb-4 flex flex-col gap-2">
        {plans.map((plan) => (
          <li key={plan.cle} className="border-border border-b pb-2 text-sm last:border-0">
            <span className="text-heading font-medium">{plan.libelle}</span>
            <span className="text-text-3 ml-2 text-xs">
              {plan.envoiLe} · {plan.destinataires} destinataire(s)
              {plan.dejaProgrammes > 0 && ` · ${plan.dejaProgrammes} déjà envoyé(s)`}
            </span>
            {plan.depasse && (
              <span className="text-warn-text ml-2 text-xs font-semibold">
                échéance passée — rien ne sera envoyé
              </span>
            )}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <Bouton
          ton="principal"
          icone={CalendarClock}
          disabled={enCours || !aProgrammer}
          onClick={() => {
            setMessage(null);
            setErreur(null);
            startTransition(async () => {
              const resultat = await planifierRappelsAction();
              if (resultat.error) setErreur(resultat.error);
              else {
                setMessage(resultat.message ?? null);
                router.refresh();
              }
            });
          }}
        >
          {enCours ? "Programmation…" : "Programmer les rappels"}
        </Bouton>
        {!aProgrammer && (
          <span className="text-text-3 text-xs">
            Toutes les échéances sont passées : plus rien à programmer.
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
