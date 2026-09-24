"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { createRateAction, deleteRateAction, type ActionState } from "../actions";

interface Tarif {
  id: string;
  roomType: string;
  price: number | null;
  currency: string;
  conditions: string | null;
}

const initialState: ActionState = {};
const CHAMP = "border-border bg-surface text-text w-full rounded-lg border px-3 py-2";

/**
 * Tarifs d'un hôtel, ajoutés et retirés ligne par ligne (§29).
 *
 * Pas de formulaire unique à lignes multiples : les tarifs arrivent un par un,
 * au fil des échanges avec l'hôtel, et un formulaire global aurait obligé à
 * tout réenregistrer pour corriger un prix. Chaque ligne est indépendante.
 *
 * Un tarif se supprime sans confirmation, contrairement à une fiche d'hôtel :
 * il se ressaisit en dix secondes, et la trace reste au journal d'audit.
 */
export function TarifsHotel({ hotelId, tarifs }: { hotelId: string; tarifs: Tarif[] }) {
  const router = useRouter();
  const ajouter = createRateAction.bind(null, hotelId);
  const [state, formAction, pending] = useActionState(ajouter, initialState);
  const [suppressionEnCours, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      {tarifs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="border-border text-text-3 border-b py-2 pr-3 text-left text-xs font-semibold">
                  Type de chambre
                </th>
                <th className="border-border text-text-3 border-b py-2 pr-3 text-left text-xs font-semibold">
                  Tarif / nuit
                </th>
                <th className="border-border text-text-3 border-b py-2 pr-3 text-left text-xs font-semibold">
                  Conditions
                </th>
                <th className="border-border border-b py-2"></th>
              </tr>
            </thead>
            <tbody>
              {tarifs.map((tarif) => (
                <tr key={tarif.id}>
                  <td className="border-border text-heading border-b py-2 pr-3">
                    {tarif.roomType}
                  </td>
                  <td className="border-border border-b py-2 pr-3 whitespace-nowrap tabular-nums">
                    {tarif.price === null
                      ? "Sur demande"
                      : `${new Intl.NumberFormat("fr-FR").format(tarif.price)} ${tarif.currency}`}
                  </td>
                  <td className="border-border text-text-2 border-b py-2 pr-3">
                    {tarif.conditions ?? "—"}
                  </td>
                  <td className="border-border border-b py-2">
                    <Bouton
                      ton="danger"
                      taille="petit"
                      icone={Trash2}
                      aria-label={`Supprimer le tarif ${tarif.roomType}`}
                      disabled={suppressionEnCours}
                      onClick={() =>
                        startTransition(async () => {
                          await deleteRateAction(tarif.id, hotelId, {});
                          router.refresh();
                        })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form
        action={formAction}
        className="border-border grid grid-cols-1 gap-3 border-t pt-4 md:grid-cols-4"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="roomType" className="text-heading text-xs font-semibold">
            Type de chambre
          </label>
          <input id="roomType" name="roomType" required className={CHAMP} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="price" className="text-heading text-xs font-semibold">
            Tarif / nuit
          </label>
          <input
            id="price"
            name="price"
            type="number"
            min={0}
            placeholder="Vide = sur demande"
            className={CHAMP}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="currency" className="text-heading text-xs font-semibold">
            Devise
          </label>
          <input id="currency" name="currency" defaultValue="XOF" className={CHAMP} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="conditions" className="text-heading text-xs font-semibold">
            Conditions
          </label>
          <input
            id="conditions"
            name="conditions"
            placeholder="Petit-déjeuner inclus…"
            className={CHAMP}
          />
        </div>

        {state.error && <p className="text-danger-text text-sm md:col-span-4">{state.error}</p>}

        <div className="md:col-span-4">
          <Bouton ton="secondaire" taille="petit" icone={Plus} type="submit" disabled={pending}>
            {pending ? "Ajout…" : "Ajouter ce tarif"}
          </Bouton>
        </div>
      </form>
    </div>
  );
}
