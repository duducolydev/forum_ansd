"use client";

import { useActionState, useState } from "react";
import { sendBulkAction, type NotificationActionState } from "../actions";
import { Eye, Send } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";

const initialState: NotificationActionState = {};

interface Props {
  templates: { key: string; subjectFr: string | null }[];
  categories: { id: string; labelFr: string }[];
  statuses: { value: string; label: string }[];
  countries: string[];
}

export function BulkSendForm({ templates, categories, statuses, countries }: Props) {
  const [state, formAction, pending] = useActionState(sendBulkAction, initialState);

  /**
   * Champs **contrôlés**. En non contrôlé, le re-rendu qui suit la
   * prévisualisation vidait les `<select>` : le formulaire échouait alors la
   * validation HTML (`templateKey` est `required`) et « Confirmer » ne
   * déclenchait plus rien — silencieusement, `requestSubmit` n'émettant même
   * pas d'événement. Défaut constaté en pilotant un vrai navigateur.
   */
  const [filters, setFilters] = useState({
    templateKey: "",
    status: "",
    categoryId: "",
    country: "",
  });

  function set(name: keyof typeof filters) {
    return (value: string) => setFilters((current) => ({ ...current, [name]: value }));
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="templateKey" className="text-heading text-sm font-semibold">
            Modèle
          </label>
          <select
            id="templateKey"
            name="templateKey"
            required
            value={filters.templateKey}
            onChange={(event) => set("templateKey")(event.target.value)}
            className="border-border bg-surface text-text rounded-lg border px-3 py-2.5 text-sm"
          >
            <option value="">—</option>
            {templates.map((template) => (
              <option key={template.key} value={template.key}>
                {template.key} — {template.subjectFr}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
          <Select
            label="Statut"
            name="status"
            options={statuses}
            value={filters.status}
            onChange={set("status")}
          />
          <Select
            label="Catégorie"
            name="categoryId"
            options={categories.map((c) => ({ value: c.id, label: c.labelFr }))}
            value={filters.categoryId}
            onChange={set("categoryId")}
          />
          <Select
            label="Pays"
            name="country"
            options={countries.map((c) => ({ value: c, label: c }))}
            value={filters.country}
            onChange={set("country")}
          />
        </div>

        <p className="text-text-3 text-sm">
          Chaque destinataire reçoit le message dans sa langue (`Participant.locale`). Les variables
          <code className="bg-bg-3 mx-1 rounded px-1 py-0.5 text-xs">prenom</code>,
          <code className="bg-bg-3 mx-1 rounded px-1 py-0.5 text-xs">nom</code>,
          <code className="bg-bg-3 mx-1 rounded px-1 py-0.5 text-xs">identifiant</code> et
          <code className="bg-bg-3 mx-1 rounded px-1 py-0.5 text-xs">lien_espace</code> sont
          renseignées automatiquement.
        </p>

        {state.error && <p className="text-danger-text text-sm">{state.error}</p>}
        {state.success && (
          <p className="bg-accent-soft text-accent-text rounded-lg px-3 py-2 text-sm">
            {state.success}
          </p>
        )}

        <Bouton
          ton="secondaire"
          icone={Eye}
          type="submit"
          disabled={pending}

          className="w-fit"
        >
          {pending ? "Calcul…" : "Prévisualiser la population"}
        </Bouton>
      </form>

      {state.preview && (
        <div className="border-border bg-surface flex flex-col gap-3 rounded-xl border p-5">
          <p className="text-heading font-semibold">
            {state.preview.total} destinataire(s) — modèle « {state.preview.templateKey} »
          </p>
          {state.preview.sample.length > 0 && (
            <ul className="text-text-2 flex flex-col gap-1 text-sm">
              {state.preview.sample.map((line) => (
                <li key={line}>{line}</li>
              ))}
              {state.preview.total > state.preview.sample.length && (
                <li className="text-text-3">
                  … et {state.preview.total - state.preview.sample.length} autre(s)
                </li>
              )}
            </ul>
          )}
          {state.preview.total === 0 ? (
            <p className="text-warn-text text-sm">
              Aucun destinataire ne correspond : ajustez les filtres.
            </p>
          ) : (
            <ConfirmForm preview={state.preview} />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Confirmation dans un **formulaire distinct**, qui rejoue le filtre exact
 * ayant produit le décompte affiché, transporté en champs cachés.
 *
 * Deux raisons. D'abord la robustesse : le formulaire de filtres est réinitialisé
 * par le re-rendu qui suit la prévisualisation, et comme `templateKey` y est
 * `required`, la confirmation échouait la validation HTML et ne déclenchait
 * plus rien — silencieusement. Ensuite la justesse : l'opérateur confirme la
 * population qu'il a vue, même s'il a modifié un filtre entre-temps.
 */
function ConfirmForm({ preview }: { preview: NonNullable<NotificationActionState["preview"]> }) {
  const [state, formAction, pending] = useActionState(sendBulkAction, initialState);

  if (state.success) {
    return (
      <p className="bg-accent-soft text-accent-text rounded-lg px-3 py-2 text-sm">
        {state.success}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="confirm" value="1" />
      <input type="hidden" name="templateKey" value={preview.templateKey} />
      <input type="hidden" name="status" value={preview.filter.status} />
      <input type="hidden" name="categoryId" value={preview.filter.categoryId} />
      <input type="hidden" name="country" value={preview.filter.country} />
      <Bouton
        ton="principal"
        icone={Send}
        type="submit"
        disabled={pending}

        className="w-fit"
      >
        {pending ? "Mise en file…" : `Confirmer l'envoi à ${preview.total} personne(s)`}
      </Bouton>
      {state.error && <p className="text-danger-text text-sm">{state.error}</p>}
    </form>
  );
}

function Select({
  label,
  name,
  options,
  value,
  onChange,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-heading text-sm font-semibold">
        {label}
      </label>
      <select
        id={name}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border-border bg-surface text-text rounded-lg border px-3 py-2.5 text-sm"
      >
        <option value="">Tous</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
