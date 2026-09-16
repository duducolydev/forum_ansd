"use client";

import { useActionState, useRef, useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { FileText, RefreshCw, Save, Upload } from "lucide-react";
import { BoutonSite } from "@/components/site/bouton-site";
import {
  consentementPresentationAction,
  deposerPhotoAction,
  enregistrerFicheAction,
  type ActionState,
} from "../actions";
import { PRESENTATION_MAX_BYTES } from "../constantes";

const initialState: ActionState = {};
const champ = "border-border bg-bg text-text w-full rounded-lg border px-3 py-2 text-sm";
const etiquette = "text-text-3 text-xs font-semibold";

export interface SpeakerVue {
  id: string;
  nom: string;
  jobTitle: string;
  organization: string;
  country: string;
  bioFr: string;
  bioEn: string;
  aPhoto: boolean;
  aPresentation: boolean;
  /** Accord pour que la présentation soit publiée sur le site (§15). */
  aConsenti: boolean;
  sessions: { id: string; titre: string; quand: string; role: string; confirmation: string }[];
}

const ROLE_LABELS: Record<string, string> = {
  MODERATOR: "Modération",
  PANELIST: "Panéliste",
  KEYNOTE: "Intervention principale",
  GUEST_OF_HONOR: "Invité d'honneur",
};

const CONFIRMATION_LABELS: Record<string, string> = {
  PRESSENTI: "Pressenti",
  CONTACTE: "Contacté",
  INVITE: "Invité",
  ACCEPTE: "Accepté",
  CONFIRME: "Confirmé",
  PRESENT: "Présent",
};

/**
 * Dépôt de la présentation, et accord pour sa publication.
 *
 * L'envoi part dès que le fichier est choisi, vers une route : la Server Action
 * d'avant refusait sans un mot tout PDF de plus de 3 Mo (§13.7, §15).
 *
 * La case d'accord agit seule, sans bouton « Enregistrer » : un accord qu'on
 * croit donné parce qu'on a coché, mais jamais envoyé, serait pire que pas
 * d'accord du tout.
 */
function DepotPresentation({ speaker }: { speaker: SpeakerVue }) {
  const champFichier = useRef<HTMLInputElement>(null);
  const [depot, setDepot] = useState<{ ton: "info" | "erreur"; texte: string } | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [accord, setAccord] = useState(speaker.aConsenti);
  const [retourAccord, setRetourAccord] = useState<ActionState>({});
  const [accordEnCours, startTransition] = useTransition();
  const router = useRouter();

  async function envoyer(evenement: ChangeEvent<HTMLInputElement>) {
    const fichier = evenement.currentTarget.files?.[0];
    if (!fichier) return;

    const vider = () => {
      if (champFichier.current) champFichier.current.value = "";
    };

    if (fichier.size > PRESENTATION_MAX_BYTES) {
      setDepot({
        ton: "erreur",
        texte: `Fichier trop lourd (maximum ${PRESENTATION_MAX_BYTES / 1024 / 1024} Mo).`,
      });
      vider();
      return;
    }

    setEnvoiEnCours(true);
    setDepot(null);
    try {
      const reponse = await fetch("/api/v1/espace-intervenant/presentation", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: fichier,
      });
      const corps = (await reponse.json().catch(() => ({}))) as {
        erreur?: string;
        sessionsReliees?: number;
      };

      if (!reponse.ok) {
        setDepot({ ton: "erreur", texte: corps.erreur ?? "Dépôt impossible." });
        return;
      }

      /*
       * Dire où va le fichier. « Présentation enregistrée » seul laissait croire
       * qu'il était arrivé chez le comité, alors qu'un intervenant sans session
       * n'alimente aucune contribution (§15.9).
       */
      const reliees = corps.sessionsReliees ?? 0;
      setDepot({
        ton: "info",
        texte:
          reliees === 0
            ? "Présentation enregistrée. Aucune session ne vous est encore attribuée : elle rejoindra les contributions dès que le comité vous en aura confié une."
            : `Présentation enregistrée. Elle est transmise au comité pour ${reliees} session${reliees > 1 ? "s" : ""}.`,
      });
      router.refresh();
    } catch {
      setDepot({ ton: "erreur", texte: "Le dépôt n'a pas abouti. Réessayez." });
    } finally {
      vider();
      setEnvoiEnCours(false);
    }
  }

  function changerAccord(valeur: boolean) {
    setAccord(valeur);
    setRetourAccord({});
    startTransition(async () => {
      const resultat = await consentementPresentationAction(valeur);
      // Refusé (lien expiré) : la case revient à ce qui est réellement en base.
      if (resultat.error) setAccord(!valeur);
      setRetourAccord(resultat);
    });
  }

  return (
    <section className="border-border bg-surface rounded-xl border p-5">
      <h2 className="text-heading mb-1 text-base font-semibold">Votre présentation</h2>
      <p className="text-text-3 mb-4 text-xs">
        PDF uniquement, {PRESENTATION_MAX_BYTES / 1024 / 1024} Mo au plus — c&apos;est le format qui
        s&apos;ouvre partout, y compris sur la machine de la régie. L&apos;envoi part dès que le
        fichier est choisi.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={champFichier}
          type="file"
          name="presentation"
          accept="application/pdf"
          aria-label="Choisir votre présentation (PDF)"
          disabled={envoiEnCours}
          onChange={(evenement) => void envoyer(evenement)}
          className="text-text-2 text-sm"
        />
        {speaker.aPresentation && (
          <a
            href={`/api/v1/speakers/${speaker.id}/presentation`}
            target="_blank"
            rel="noopener"
            className="text-link inline-flex items-center gap-1.5 text-sm font-semibold"
          >
            <FileText aria-hidden size={14} />
            Voir le PDF déposé
          </a>
        )}
      </div>

      {envoiEnCours && <p className="text-text-3 mt-2 text-sm">Envoi en cours…</p>}
      {depot && (
        <p
          role="status"
          className={`mt-2 text-sm ${depot.ton === "erreur" ? "text-danger-text" : "text-text-3"}`}
        >
          {depot.texte}
        </p>
      )}

      <div className="border-border mt-4 border-t pt-4">
        <label htmlFor="accord-publication" className="text-text-2 flex items-start gap-2 text-sm">
          <input
            id="accord-publication"
            type="checkbox"
            checked={accord}
            disabled={accordEnCours}
            onChange={(evenement) => changerAccord(evenement.target.checked)}
            className="mt-1"
          />
          <span>J&apos;autorise la publication de ma présentation sur le site du Forum</span>
        </label>
        <p className="text-text-3 mt-1.5 text-xs">
          {speaker.sessions.length > 0
            ? "Votre présentation rejoint les contributions de vos sessions, pour les Actes du Forum."
            : "Elle rejoindra les contributions de vos sessions dès que le comité vous y aura inscrit."}{" "}
          Elle n&apos;est mise en ligne qu&apos;avec votre accord, et après validation du comité.
          Déposer un nouveau fichier la retire du site jusqu&apos;à nouvelle validation.
        </p>
        {retourAccord.error && (
          <p role="status" className="text-danger-text mt-2 text-sm">
            {retourAccord.error}
          </p>
        )}
        {retourAccord.message && !retourAccord.error && (
          <p role="status" className="text-text-3 mt-2 text-sm">
            {retourAccord.message}
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * Espace de dépôt d'un intervenant (brief §5.8).
 *
 * Trois blocs séparés plutôt qu'un seul formulaire : un envoi de fichier échoue
 * pour ses propres raisons — trop lourd, mauvais format — et les mêler à la
 * biographie ferait perdre un texte long à chaque refus.
 *
 * Le statut de confirmation par session est **en lecture seule** : c'est le
 * comité qui l'établit. L'afficher permet à l'intervenant de constater où il en
 * est sans avoir à écrire.
 */
export function SpeakerSpace({ speaker }: { speaker: SpeakerVue }) {
  const [fiche, ficheAction, fichePending] = useActionState(enregistrerFicheAction, initialState);
  const [photo, photoAction, photoPending] = useActionState(deposerPhotoAction, initialState);

  return (
    <div className="flex flex-col gap-6">
      {speaker.sessions.length > 0 && (
        <section className="border-border bg-surface rounded-xl border p-5">
          <h2 className="text-heading mb-3 text-base font-semibold">Vos interventions</h2>
          <ul className="flex flex-col gap-2">
            {speaker.sessions.map((session) => (
              <li key={session.id} className="border-border border-b pb-2 text-sm last:border-0">
                <span className="text-heading block font-medium">{session.titre}</span>
                <span className="text-text-3 text-xs">
                  {session.quand} · {ROLE_LABELS[session.role] ?? session.role} ·{" "}
                  {CONFIRMATION_LABELS[session.confirmation] ?? session.confirmation}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form action={ficheAction} className="border-border bg-surface rounded-xl border p-5">
        <h2 className="text-heading mb-4 text-base font-semibold">Votre fiche</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="jobTitle" className={etiquette}>
              Fonction
            </label>
            <input
              id="jobTitle"
              name="jobTitle"
              maxLength={150}
              defaultValue={speaker.jobTitle}
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
              defaultValue={speaker.organization}
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
              defaultValue={speaker.country}
              className={champ}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="bioFr" className={etiquette}>
              Biographie (français)
            </label>
            <textarea
              id="bioFr"
              name="bioFr"
              rows={6}
              maxLength={3000}
              defaultValue={speaker.bioFr}
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
              rows={6}
              maxLength={3000}
              defaultValue={speaker.bioEn}
              className={champ}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <BoutonSite
            type="submit"
            disabled={fichePending}
            ton="principal"
            taille="compact"
            icone={Save}
          >
            {fichePending ? "Enregistrement…" : "Enregistrer"}
          </BoutonSite>
          {fiche.error && <p className="text-danger-text text-sm">{fiche.error}</p>}
          {fiche.message && !fiche.error && <p className="text-text-3 text-sm">{fiche.message}</p>}
        </div>
      </form>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <form action={photoAction} className="border-border bg-surface rounded-xl border p-5">
          <h2 className="text-heading mb-1 text-base font-semibold">Votre photo</h2>
          <p className="text-text-3 mb-4 text-xs">
            JPEG, PNG ou WebP, 2 Mo au plus. Elle paraît sur la fiche de vos sessions.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {speaker.aPhoto && (
              /* eslint-disable-next-line @next/next/no-img-element -- servie par une route dédiée, hors optimiseur */
              <img
                src={`/api/v1/speakers/${speaker.id}/photo`}
                alt=""
                className="border-border h-16 w-16 rounded-full border object-cover"
              />
            )}
            <input
              type="file"
              name="photo"
              accept="image/jpeg,image/png,image/webp"
              required
              className="text-text-2 text-sm"
            />
            <BoutonSite
              type="submit"
              disabled={photoPending}
              taille="compact"
              icone={speaker.aPhoto ? RefreshCw : Upload}
            >
              {speaker.aPhoto ? "Remplacer" : "Déposer"}
            </BoutonSite>
          </div>
          {photo.error && <p className="text-danger-text mt-2 text-sm">{photo.error}</p>}
          {photo.message && !photo.error && (
            <p className="text-text-3 mt-2 text-sm">{photo.message}</p>
          )}
        </form>

        <DepotPresentation speaker={speaker} />
      </div>
    </div>
  );
}
