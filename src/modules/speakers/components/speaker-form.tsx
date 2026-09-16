"use client";

import { useActionState } from "react";
import { enregistrerIntervenantAction, type ActionState } from "../actions";
import { Save } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";

const initialState: ActionState = {};
const champ = "border-border bg-bg text-text w-full rounded-lg border px-3 py-2 text-sm";
const etiquette = "text-text-3 text-xs font-semibold";

export interface SpeakerFormValues {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  organization: string;
  country: string;
  bioFr: string;
  bioEn: string;
  isPublished: boolean;
}

export function SpeakerForm({ valeurs }: { valeurs: SpeakerFormValues }) {
  const [state, formAction, pending] = useActionState(enregistrerIntervenantAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {valeurs.id && <input type="hidden" name="id" value={valeurs.id} />}

      <section className="border-border bg-surface rounded-xl border p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="firstName" className={etiquette}>
              Prénom *
            </label>
            <input
              id="firstName"
              name="firstName"
              required
              maxLength={80}
              defaultValue={valeurs.firstName}
              className={champ}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="lastName" className={etiquette}>
              Nom *
            </label>
            <input
              id="lastName"
              name="lastName"
              required
              maxLength={80}
              defaultValue={valeurs.lastName}
              className={champ}
            />
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label htmlFor="email" className={etiquette}>
              Adresse e-mail — sans elle, l&apos;intervenant ne peut pas recevoir son lien
              d&apos;accès
            </label>
            <input
              id="email"
              name="email"
              type="email"
              defaultValue={valeurs.email}
              className={champ}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="jobTitle" className={etiquette}>
              Fonction
            </label>
            <input
              id="jobTitle"
              name="jobTitle"
              maxLength={150}
              defaultValue={valeurs.jobTitle}
              className={champ}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="organization" className={etiquette}>
              Organisation
            </label>
            <input
              id="organization"
              name="organization"
              maxLength={150}
              defaultValue={valeurs.organization}
              className={champ}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="country" className={etiquette}>
              Pays
            </label>
            <input
              id="country"
              name="country"
              maxLength={80}
              defaultValue={valeurs.country}
              className={champ}
            />
          </div>
        </div>
      </section>

      <section className="border-border bg-surface rounded-xl border p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="bioFr" className={etiquette}>
              Biographie (français)
            </label>
            <textarea
              id="bioFr"
              name="bioFr"
              rows={5}
              maxLength={3000}
              defaultValue={valeurs.bioFr}
              className={champ}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="bioEn" className={etiquette}>
              Biographie (anglais)
            </label>
            <textarea
              id="bioEn"
              name="bioEn"
              rows={5}
              maxLength={3000}
              defaultValue={valeurs.bioEn}
              className={champ}
            />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <label className="text-text-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isPublished"
            defaultChecked={valeurs.isPublished}
            className="accent-primary h-4 w-4"
          />
          Publier sur le site
        </label>
        <Bouton ton="principal" icone={Save} type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Bouton>
        {state.error && <p className="text-danger-text text-sm">{state.error}</p>}
        {state.message && !state.error && <p className="text-text-3 text-sm">{state.message}</p>}
      </div>
    </form>
  );
}
