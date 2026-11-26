"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FileText, Save } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { creerNewsletterAction, modifierNewsletterAction } from "../actions";
import { FICHIER_NEWSLETTER_MAX_BYTES, poidsLisible } from "../schema";

const CHAMP = "border-border bg-surface text-text w-full rounded-lg border px-3 py-2.5";
const ETIQUETTE = "text-heading text-sm font-semibold";

interface Valeurs {
  titleFr?: string;
  titleEn?: string;
  titlePt?: string;
  excerptFr?: string;
  excerptEn?: string;
  excerptPt?: string;
}

/** Dépose le fichier par la route (une Server Action s'arrête à 3 Mo). */
async function deposer(id: string, fichier: File): Promise<string | null> {
  const reponse = await fetch(`/api/v1/newsletters/${id}/fichier`, {
    method: "POST",
    headers: {
      "Content-Type": "application/pdf",
      "X-Nom-Fichier": encodeURIComponent(fichier.name),
    },
    body: fichier,
  });
  if (reponse.ok) return null;
  const corps = (await reponse.json().catch(() => null)) as { erreur?: string } | null;
  return corps?.erreur ?? `Dépôt du fichier impossible (${reponse.status}).`;
}

/**
 * Saisie d'une newsletter (25 novembre 2026) : titre, description et fichier
 * de synthèse en PDF.
 *
 * Le fichier est **obligatoire à la création**. Il part après l'enregistrement
 * du texte, par une route : si son dépôt échoue, le brouillon existe déjà et
 * la fiche invite à recommencer — rien de ce qui a été saisi n'est perdu.
 */
export function FormulaireNewsletter({
  newsletterId,
  defaultValues,
  fichierActuel,
}: {
  /** Absent à la création. */
  newsletterId?: string;
  defaultValues?: Valeurs;
  fichierActuel?: { nom: string; octets: number | null } | null;
}) {
  const router = useRouter();
  const formulaire = useRef<HTMLFormElement>(null);
  const [fichier, setFichier] = useState<File | null>(null);
  const [message, setMessage] = useState<{ texte: string; erreur: boolean } | null>(null);
  const [enCours, startTransition] = useTransition();
  const d = defaultValues ?? {};
  const creation = !newsletterId;

  function choisir(choisi: File | null) {
    setMessage(null);
    if (choisi && choisi.size > FICHIER_NEWSLETTER_MAX_BYTES) {
      setMessage({
        texte: `Fichier trop lourd (maximum ${FICHIER_NEWSLETTER_MAX_BYTES / 1024 / 1024} Mo).`,
        erreur: true,
      });
      setFichier(null);
      return;
    }
    setFichier(choisi);
  }

  function soumettre(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (creation && !fichier) {
      setMessage({ texte: "Joignez le fichier PDF de la newsletter.", erreur: true });
      return;
    }
    const donnees = new FormData(evenement.currentTarget);
    donnees.delete("fichier");

    startTransition(async () => {
      const resultat = creation
        ? await creerNewsletterAction({}, donnees)
        : await modifierNewsletterAction(newsletterId, {}, donnees);
      if (resultat.erreur || !resultat.id) {
        setMessage({ texte: resultat.erreur ?? "Enregistrement impossible.", erreur: true });
        return;
      }

      const echecDepot = fichier ? await deposer(resultat.id, fichier) : null;
      if (creation) {
        // Le brouillon existe : sa fiche reprend la main, et y signale un
        // fichier manquant si le dépôt a échoué.
        router.push(`/admin/newsletters/${resultat.id}`);
        return;
      }
      setFichier(null);
      if (formulaire.current) {
        const champ = formulaire.current.elements.namedItem("fichier");
        if (champ instanceof HTMLInputElement) champ.value = "";
      }
      setMessage(
        echecDepot
          ? { texte: `Texte enregistré, mais ${echecDepot}`, erreur: true }
          : {
              texte: fichier ? "Newsletter et fichier enregistrés." : "Newsletter enregistrée.",
              erreur: false,
            },
      );
      router.refresh();
    });
  }

  return (
    <form ref={formulaire} onSubmit={soumettre} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="titleFr" className={ETIQUETTE}>
          Titre
        </label>
        <input
          id="titleFr"
          name="titleFr"
          required
          maxLength={200}
          defaultValue={d.titleFr}
          className={CHAMP}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="excerptFr" className={ETIQUETTE}>
          Description
        </label>
        <textarea
          id="excerptFr"
          name="excerptFr"
          required
          rows={4}
          maxLength={600}
          defaultValue={d.excerptFr}
          className={CHAMP}
        />
        <span className="text-text-3 text-xs">
          Affichée sur le portail et reprise dans le courriel d&apos;annonce. 600 caractères au
          maximum.
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="fichier" className={ETIQUETTE}>
          Fichier de synthèse (PDF){creation ? "" : " — remplacer"}
        </label>
        {fichierActuel && (
          <span className="text-text-2 flex items-center gap-1.5 text-sm">
            <FileText aria-hidden size={15} />
            {fichierActuel.nom}
            {fichierActuel.octets ? ` · ${poidsLisible(fichierActuel.octets)}` : ""}
          </span>
        )}
        <input
          id="fichier"
          name="fichier"
          type="file"
          accept="application/pdf,.pdf"
          required={creation}
          onChange={(evenement) => choisir(evenement.target.files?.[0] ?? null)}
          className="text-text text-sm"
        />
        <span className="text-text-3 text-xs">
          {creation
            ? `Obligatoire. PDF uniquement, ${FICHIER_NEWSLETTER_MAX_BYTES / 1024 / 1024} Mo au maximum.`
            : "Facultatif : laissez vide pour garder le fichier actuel. Un fichier remplacé après l'envoi est celui que téléchargeront les destinataires."}
        </span>
      </div>

      <details className="border-border rounded-lg border px-4 py-3">
        <summary className="text-heading cursor-pointer text-sm font-semibold">
          Traductions (facultatif)
        </summary>
        <p className="text-text-3 mt-2 text-xs">
          Vides, le français est repris. L&apos;annonce part dans la langue de chaque participant.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="titleEn" className={ETIQUETTE}>
              Titre (anglais)
            </label>
            <input
              id="titleEn"
              name="titleEn"
              maxLength={200}
              defaultValue={d.titleEn}
              className={CHAMP}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="titlePt" className={ETIQUETTE}>
              Titre (portugais)
            </label>
            <input
              id="titlePt"
              name="titlePt"
              maxLength={200}
              defaultValue={d.titlePt}
              className={CHAMP}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="excerptEn" className={ETIQUETTE}>
              Description (anglais)
            </label>
            <textarea
              id="excerptEn"
              name="excerptEn"
              rows={3}
              maxLength={600}
              defaultValue={d.excerptEn}
              className={CHAMP}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="excerptPt" className={ETIQUETTE}>
              Description (portugais)
            </label>
            <textarea
              id="excerptPt"
              name="excerptPt"
              rows={3}
              maxLength={600}
              defaultValue={d.excerptPt}
              className={CHAMP}
            />
          </div>
        </div>
      </details>

      {message && (
        <p
          role="status"
          className={`text-sm ${message.erreur ? "text-danger-text" : "text-accent-text"}`}
        >
          {message.texte}
        </p>
      )}

      <div>
        <Bouton type="submit" ton="principal" icone={Save} disabled={enCours}>
          {enCours ? "Enregistrement…" : creation ? "Créer le brouillon" : "Enregistrer"}
        </Bouton>
      </div>
    </form>
  );
}
