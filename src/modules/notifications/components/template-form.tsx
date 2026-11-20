"use client";

import { LANGUES, traduire, type Langue } from "@/lib/langue";
import { useActionState, useMemo, useState } from "react";
import { updateTemplateAction, type NotificationActionState } from "../actions";
import { Save } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import {
  baliserLiens,
  corpsCourriel,
  gabaritCourriel,
  resumeCourriel,
  type PiedCourriel,
} from "../courriel";

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
  /**
   * Variables réellement remplacées à l'envoi — `declared`, plus celles du
   * programme, résolues dans n'importe quel modèle. L'avertissement s'appuie
   * sur cette liste : reprocher `{{programme}}`, qui part bien rempli, aurait
   * envoyé l'éditeur corriger un modèle juste.
   */
  resolues: string[];
  /** Valeurs d'exemple pour la prévisualisation, par variable. */
  sampleVariables: Record<string, string>;
  /** Signature du gabarit, par langue — lue en base côté serveur. */
  pieds: Record<Langue, PiedCourriel>;
  baseUrl: string;
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
  resolues,
  sampleVariables,
  pieds,
  baseUrl,
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
    const substitute = (text: string, variables: Record<string, string>) =>
      text.replace(/\{\{(\w+)\}\}/g, (match, name: string) => variables[name] ?? match);

    /*
     * Le message **tel qu'il partira**, construit avec les mêmes fonctions que
     * l'envoi (`courriel.ts`), qui sont pures et tournent donc aussi bien
     * ici. Un aperçu en texte nu laissait deviner le résultat : on ne voyait
     * ni les boutons, ni les logos, ni la signature — c'est-à-dire presque
     * tout ce qu'un relecteur doit valider.
     */
    const html = gabaritCourriel({
      corps: corpsCourriel(substitute(body, baliserLiens(sampleVariables, locale))),
      langue: locale,
      baseUrl,
      pied: pieds[locale],
      // Déduit du corps, comme à l'envoi : l'aperçu doit montrer ce que la
      // boîte de réception affichera, pas une approximation.
      preheader: resumeCourriel(substitute(body, sampleVariables)),
    });

    return {
      subject: substitute(subject, sampleVariables),
      body: substitute(body, sampleVariables),
      html,
    };
  }, [subject, body, sampleVariables, locale, pieds, baseUrl]);

  const undeclared = useMemo(() => {
    const used = new Set<string>();
    for (const text of Object.values(values)) {
      for (const match of text.matchAll(/\{\{(\w+)\}\}/g)) used.add(match[1]!);
    }
    return [...used].filter((name) => !resolues.includes(name)).sort();
  }, [values, resolues]);

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

        {/*
          Mise en forme (20 novembre 2026). Le corps reste du texte — c'est ce
          qui permet de le relire sans connaître HTML —, mais l'envoi
          l'enveloppe désormais dans le gabarit du Forum. Le dire ici : sans
          cette note, personne ne devinerait qu'une adresse en fin de ligne
          devient un bouton.
        */}
        <div className="border-border text-text-3 rounded-lg border border-dashed px-3 py-2.5 text-xs">
          <p className="text-text-2 mb-1 font-semibold">Liens et boutons</p>
          <p>
            Une adresse <b>en fin de ligne</b> devient un bouton ; la phrase qui la précède reste
            au-dessus. Au milieu d&apos;une phrase, elle reste un lien souligné.
          </p>
          <p className="mt-1">
            Pour choisir le texte du bouton, écrivez{" "}
            <code className="bg-bg-3 text-text-2 rounded px-1 py-0.5">
              [Réserver ma place](https://…)
            </code>
            . Les variables de lien ({`{{lien_espace}}`}, {`{{lien_badge}}`}, {`{{lien_direct}}`}…)
            sont nommées automatiquement.
          </p>
          <p className="mt-1">
            Le premier bouton est plein, les suivants au trait : un message n&apos;a qu&apos;une
            action principale. Logos, couleurs et signature sont ajoutés à l&apos;envoi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-text-3 text-sm">Variables :</span>
          {declared.map((name) => (
            <code key={name} className="bg-bg-3 text-text-2 rounded px-1.5 py-0.5 text-xs">
              {`{{${name}}}`}
            </code>
          ))}
        </div>

        {/* Le programme se glisse dans n'importe quel modèle : le dire ici
            évite d'avoir à le deviner, ou à le découvrir par l'avertissement. */}
        {resolues.some((name) => !declared.includes(name)) && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-text-3 text-sm">
              Aussi disponibles, remplies à l&apos;envoi :
            </span>
            {resolues
              .filter((name) => !declared.includes(name))
              .map((name) => (
                <code key={name} className="bg-bg-3 text-text-2 rounded px-1.5 py-0.5 text-xs">
                  {`{{${name}}}`}
                </code>
              ))}
          </div>
        )}

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
        <p className="text-text-3 mb-1 text-xs">Message</p>
        {/*
          Rendu dans un `iframe` et non dans la page : le courriel porte ses
          propres styles en ligne, et le BackOffice les siens. Posés dans le
          même document, les deux se mélangeraient et l'aperçu mentirait.

          `sandbox` vide : aucun script, aucune navigation. Le corps vient du
          BackOffice, mais un aperçu n'a aucune raison de pouvoir s'exécuter,
          et les liens ne doivent pas emmener le relecteur ailleurs.
        */}
        <iframe
          title={`Aperçu du courriel (${locale.toUpperCase()})`}
          srcDoc={preview.html}
          sandbox=""
          className="border-border h-[560px] w-full rounded-lg border bg-white"
        />

        <details className="mt-3">
          <summary className="text-text-3 cursor-pointer text-xs">
            Version texte (clients sans HTML)
          </summary>
          <div className="text-text-2 mt-2 flex flex-col gap-2 text-sm">
            {preview.body.split("\n").map((line, index) => (
              <p key={index}>{line || " "}</p>
            ))}
          </div>
        </details>
      </div>
    </form>
  );
}
