"use client";

import { LANGUES, traduire, type Langue } from "@/lib/langue";
import { useActionState, useMemo, useState } from "react";
import { updateTemplateAction, type NotificationActionState } from "../actions";
import { Save } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";

const initialState: NotificationActionState = {};

interface Props {
  templateKey: string;
  subjectFr: string;
  subjectEn: string;
  subjectPt: string;
  bodyFr: string;
  bodyEn: string;
  bodyPt: string;
  declared: string[];
  /** Valeurs d'exemple pour la prévisualisation, par variable. */
  sampleVariables: Record<string, string>;
}

export function TemplateForm({
  templateKey,
  subjectFr,
  subjectEn,
  subjectPt,
  bodyFr,
  bodyEn,
  bodyPt,
  declared,
  sampleVariables,
}: Props) {
  const action = updateTemplateAction.bind(null, templateKey);
  const [state, formAction, pending] = useActionState(action, initialState);

  const [values, setValues] = useState({
    subjectFr,
    subjectEn,
    subjectPt,
    bodyFr,
    bodyEn,
    bodyPt,
  });
  const [locale, setLocale] = useState<Langue>("fr");

  // Aperçu : un portugais vide montre l'anglais, comme à l'envoi.
  const subject = traduire(locale, {
    fr: values.subjectFr,
    en: values.subjectEn,
    pt: values.subjectPt,
  });
  const body = traduire(locale, { fr: values.bodyFr, en: values.bodyEn, pt: values.bodyPt });

  /**
   * Prévisualisation calculée côté client à partir de la saisie en cours : elle
   * doit refléter ce qui est tapé, pas ce qui est enregistré. La substitution
   * reproduit exactement `interpolate` du service (variable inconnue laissée
   * telle quelle), pour que l'aperçu ne mente pas.
   */
  const preview = useMemo(() => {
    const substitute = (text: string) =>
      text.replace(/\{\{(\w+)\}\}/g, (match, name: string) => sampleVariables[name] ?? match);
    return { subject: substitute(subject), body: substitute(body) };
  }, [subject, body, sampleVariables]);

  const undeclared = useMemo(() => {
    const used = new Set<string>();
    for (const text of Object.values(values)) {
      for (const match of text.matchAll(/\{\{(\w+)\}\}/g)) used.add(match[1]!);
    }
    return [...used].filter((name) => !declared.includes(name)).sort();
  }, [values, declared]);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <div className="flex gap-1">
          {LANGUES.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setLocale(code)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                locale === code
                  ? "bg-primary text-primary-text"
                  : "border-border text-text-2 border"
              }`}
            >
              {code.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Les deux langues restent dans le DOM : masquer par `hidden` conserve
            les champs dans le FormData, sinon basculer FR→EN avant d'enregistrer
            effacerait la langue non affichée. */}
        {LANGUES.map((code) => {
          const subjectName = ({ fr: "subjectFr", en: "subjectEn", pt: "subjectPt" } as const)[
            code
          ];
          const bodyName = ({ fr: "bodyFr", en: "bodyEn", pt: "bodyPt" } as const)[code];
          return (
            <div key={code} hidden={locale !== code} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={subjectName} className="text-heading text-sm font-semibold">
                  Objet ({code.toUpperCase()})
                </label>
                <input
                  id={subjectName}
                  name={subjectName}
                  value={values[subjectName]}
                  onChange={(e) => setValues((v) => ({ ...v, [subjectName]: e.target.value }))}
                  className="border-border bg-surface text-text rounded-lg border px-3 py-2.5 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={bodyName} className="text-heading text-sm font-semibold">
                  Corps ({code.toUpperCase()})
                </label>
                <textarea
                  id={bodyName}
                  name={bodyName}
                  rows={14}
                  value={values[bodyName]}
                  onChange={(e) => setValues((v) => ({ ...v, [bodyName]: e.target.value }))}
                  className="border-border bg-surface text-text rounded-lg border px-3 py-2.5 font-mono text-sm"
                />
              </div>
            </div>
          );
        })}

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-text-3 text-sm">Variables :</span>
          {declared.map((name) => (
            <code key={name} className="bg-bg-3 text-text-2 rounded px-1.5 py-0.5 text-xs">
              {`{{${name}}}`}
            </code>
          ))}
        </div>

        {undeclared.length > 0 && (
          <p className="bg-warn-soft text-warn-text rounded-lg px-3 py-2 text-sm">
            Variables utilisées mais non déclarées :{" "}
            <b>{undeclared.map((n) => `{{${n}}}`).join(", ")}</b>. Elles partiront telles quelles
            dans l&apos;e-mail — vérifiez l&apos;orthographe.
          </p>
        )}

        {state.error && <p className="text-danger-text text-sm">{state.error}</p>}
        {state.success && <p className="text-accent-text text-sm">{state.success}</p>}

        <Bouton
          ton="principal"
          icone={Save}
          type="submit"
          disabled={pending}

          className="w-fit"
        >
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Bouton>
      </div>

      <div className="border-border bg-surface h-fit rounded-xl border p-5">
        <h3 className="text-heading mb-3 text-sm font-semibold">
          Aperçu ({locale.toUpperCase()}) — valeurs d&apos;exemple
        </h3>
        <p className="text-text-3 mb-1 text-xs">Objet</p>
        <p className="text-heading mb-4 font-semibold">{preview.subject || "—"}</p>
        <p className="text-text-3 mb-1 text-xs">Corps</p>
        <div className="text-text-2 flex flex-col gap-2 text-sm">
          {preview.body.split("\n").map((line, index) => (
            <p key={index}>{line || " "}</p>
          ))}
        </div>
      </div>
    </form>
  );
}
