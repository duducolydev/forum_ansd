"use client";

import { Save } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";

import { useActionState } from "react";
import type { ActionState } from "../actions";
import type { PostInput } from "../schema";

interface Props {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues?: Partial<PostInput>;
  submitLabel: string;
}

const initialState: ActionState = {};

export function PostForm({ action, defaultValues, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const d = defaultValues ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-3.5">
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="titleFr" className="text-heading text-sm font-semibold">
            Titre (français)
          </label>
          <input
            id="titleFr"
            name="titleFr"
            required
            defaultValue={d.titleFr}
            className="border-border bg-surface text-text rounded-lg border px-3 py-2.5"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="titleEn" className="text-heading text-sm font-semibold">
            Titre (anglais)
          </label>
          <input
            id="titleEn"
            name="titleEn"
            defaultValue={d.titleEn}
            className="border-border bg-surface text-text rounded-lg border px-3 py-2.5"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="slug" className="text-heading text-sm font-semibold">
          Slug (URL)
        </label>
        <input
          id="slug"
          name="slug"
          required
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          defaultValue={d.slug}
          placeholder="ouverture-des-inscriptions"
          className="border-border bg-surface text-text rounded-lg border px-3 py-2.5"
        />
      </div>

      {/* Chapô : c'est ce que montrent la liste d'actualités et les aperçus
          partagés sur les réseaux. Sans lui, la liste coupait le corps au
          hasard, souvent au milieu d'un mot. */}
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="excerptFr" className="text-heading text-sm font-semibold">
            Chapô (français)
          </label>
          <textarea
            id="excerptFr"
            name="excerptFr"
            rows={2}
            maxLength={300}
            defaultValue={d.excerptFr}
            placeholder="Deux phrases : ce que le lecteur verra dans la liste."
            className="border-border bg-surface text-text rounded-lg border px-3 py-2.5"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="excerptEn" className="text-heading text-sm font-semibold">
            Chapô (anglais)
          </label>
          <textarea
            id="excerptEn"
            name="excerptEn"
            rows={2}
            maxLength={300}
            defaultValue={d.excerptEn}
            className="border-border bg-surface text-text rounded-lg border px-3 py-2.5"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="bodyFr" className="text-heading text-sm font-semibold">
            Contenu (français)
          </label>
          <textarea
            id="bodyFr"
            name="bodyFr"
            required
            rows={8}
            defaultValue={d.bodyFr}
            className="border-border bg-surface text-text rounded-lg border px-3 py-2.5"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="bodyEn" className="text-heading text-sm font-semibold">
            Contenu (anglais)
          </label>
          <textarea
            id="bodyEn"
            name="bodyEn"
            rows={8}
            defaultValue={d.bodyEn}
            className="border-border bg-surface text-text rounded-lg border px-3 py-2.5"
          />
        </div>
      </div>

      <label className="text-heading flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          name="isPublished"
          defaultChecked={d.isPublished}
          className="accent-primary"
        />
        Publier immédiatement
      </label>

      {state.error && <p className="text-danger-text text-sm">{state.error}</p>}

      <div>
        <Bouton ton="principal" icone={Save} type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : submitLabel}
        </Bouton>
      </div>
    </form>
  );
}
