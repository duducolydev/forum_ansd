"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { createContactAction, deleteContactAction, type ActionState } from "../actions";

interface Contact {
  id: string;
  labelFr: string;
  labelEn: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
}

const initialState: ActionState = {};
const CHAMP = "border-border bg-surface text-text w-full rounded-lg border px-3 py-2";
const TH = "border-border text-text-3 border-b py-2 pr-3 text-left text-xs font-semibold";

/**
 * Contacts publiés sur la page « Infos pratiques &rsaquo; Contacts » (§29).
 *
 * Même parti pris que les tarifs : une ligne à la fois, ajoutée et retirée
 * indépendamment. Ces contacts changent au fil de l'organisation, souvent la
 * veille, et un formulaire global aurait forcé à tout revalider pour corriger
 * un numéro.
 */
export function ContactsPratiques({ contacts }: { contacts: Contact[] }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createContactAction, initialState);
  const [suppressionEnCours, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-5">
      {contacts.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={TH}>Intitulé</th>
                <th className={TH}>Personne</th>
                <th className={TH}>E-mail</th>
                <th className={TH}>Téléphone</th>
                <th className="border-border border-b py-2"></th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr key={contact.id}>
                  <td className="border-border text-heading border-b py-2 pr-3">
                    {contact.labelFr}
                    {contact.labelEn && (
                      <span className="text-text-3 font-normal"> · {contact.labelEn}</span>
                    )}
                  </td>
                  <td className="border-border text-text-2 border-b py-2 pr-3">
                    {contact.name ?? "—"}
                  </td>
                  <td className="border-border text-text-2 border-b py-2 pr-3">
                    {contact.email ?? "—"}
                  </td>
                  <td className="border-border text-text-2 border-b py-2 pr-3">
                    {contact.phone ?? "—"}
                  </td>
                  <td className="border-border border-b py-2">
                    <Bouton
                      ton="danger"
                      taille="petit"
                      icone={Trash2}
                      aria-label={`Supprimer le contact ${contact.labelFr}`}
                      disabled={suppressionEnCours}
                      onClick={() =>
                        startTransition(async () => {
                          await deleteContactAction(contact.id, {});
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
        className="border-border grid grid-cols-1 gap-3 border-t pt-4 md:grid-cols-2"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="labelFr" className="text-heading text-xs font-semibold">
            Intitulé (français)
          </label>
          <input
            id="labelFr"
            name="labelFr"
            required
            placeholder="Accréditation presse"
            className={CHAMP}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="labelEn" className="text-heading text-xs font-semibold">
            Intitulé (anglais)
          </label>
          <input
            id="labelEn"
            name="labelEn"
            placeholder="Vide, le français est repris"
            className={CHAMP}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-heading text-xs font-semibold">
            Personne
          </label>
          <input id="name" name="name" className={CHAMP} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-heading text-xs font-semibold">
            E-mail
          </label>
          <input id="email" name="email" type="email" className={CHAMP} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="phone" className="text-heading text-xs font-semibold">
            Téléphone
          </label>
          <input id="phone" name="phone" className={CHAMP} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="sortOrder" className="text-heading text-xs font-semibold">
            Ordre d&apos;affichage
          </label>
          <input
            id="sortOrder"
            name="sortOrder"
            type="number"
            min={0}
            defaultValue={0}
            className={CHAMP}
          />
        </div>

        {state.error && <p className="text-danger-text text-sm md:col-span-2">{state.error}</p>}

        <div className="md:col-span-2">
          <Bouton ton="secondaire" taille="petit" icone={Plus} type="submit" disabled={pending}>
            {pending ? "Ajout…" : "Ajouter ce contact"}
          </Bouton>
        </div>
      </form>
    </div>
  );
}
