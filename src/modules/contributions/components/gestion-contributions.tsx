"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import type { Contribution } from "@prisma/client";
import {
  ArrowDown,
  ArrowUp,
  Check,
  FileText,
  Link2,
  Lock,
  Plus,
  Save,
  Trash2,
  Upload,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { auClicConfirme } from "@/components/ui/confirmer";
import { useSoumissionSansRemiseAZero } from "@/lib/soumission";
import {
  creerContributionAction,
  deplacerContributionAction,
  modifierContributionAction,
  rattacherRapporteurAction,
  retirerRapporteurAction,
  supprimerContributionAction,
  type EtatAction,
} from "../actions";
import { peutModifier, peutOrdonner, type NiveauAcces } from "../droits";
import { DOCUMENT_MAX_BYTES } from "../fichier";
import { MODELES, TYPES_CONTRIBUTION, type TypeContribution } from "../schema";

const etatInitial: EtatAction = {};

const CHAMP = "border-border bg-bg text-text w-full rounded-lg border px-3 py-2.5 text-sm";
const ETIQUETTE = "text-text-3 text-xs font-semibold";
const PASTILLE = "rounded-md px-2 py-0.5 text-xs font-semibold";

/** Un écran de gestion ne s'ouvre qu'à qui a un accès : « aucun » n'y arrive pas. */
export type NiveauGestion = Exclude<NiveauAcces, "aucun">;

export interface IntervenantChoix {
  id: string;
  nom: string;
}

export interface CompteChoix {
  id: string;
  nom: string;
  email: string;
}

/**
 * Dépôt du fichier d'une contribution.
 *
 * Il passe par une **route** et non par l'action d'enregistrement : le brief
 * autorise 50 Mo, et les Server Actions rejettent au-delà de 3 Mo sans qu'aucun
 * message ne parvienne à l'agent (§13.7). L'envoi part dès que le fichier est
 * choisi — la leçon du logo de partenaire, où un second bouton faisait perdre
 * le fichier (§11.7).
 */
function DepotFichier({
  contributionId,
  aUnFichier,
  attendu,
}: {
  contributionId: string;
  aUnFichier: boolean;
  attendu: "document" | "image";
}) {
  const champ = useRef<HTMLInputElement>(null);
  const [etat, setEtat] = useState<{ ton: "info" | "erreur"; texte: string } | null>(null);
  const [enCours, setEnCours] = useState(false);
  const router = useRouter();

  async function envoyer(evenement: ChangeEvent<HTMLInputElement>) {
    const fichier = evenement.currentTarget.files?.[0];
    if (!fichier) return;

    if (fichier.size > DOCUMENT_MAX_BYTES) {
      setEtat({
        ton: "erreur",
        texte: `Fichier trop lourd (maximum ${DOCUMENT_MAX_BYTES / 1024 / 1024} Mo).`,
      });
      if (champ.current) champ.current.value = "";
      return;
    }

    setEnCours(true);
    setEtat(null);
    try {
      const reponse = await fetch(`/api/v1/contributions/${contributionId}/fichier`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: fichier,
      });
      const corps = (await reponse.json()) as { erreur?: string };

      if (!reponse.ok) {
        setEtat({ ton: "erreur", texte: corps.erreur ?? "Dépôt impossible." });
        if (champ.current) champ.current.value = "";
        return;
      }

      setEtat({ ton: "info", texte: "Fichier déposé." });
      if (champ.current) champ.current.value = "";
      router.refresh();
    } catch {
      setEtat({ ton: "erreur", texte: "Le dépôt n'a pas abouti. Réessayez." });
    } finally {
      setEnCours(false);
    }
  }

  const accept =
    attendu === "image"
      ? "image/png,image/jpeg,image/webp,image/svg+xml"
      : "application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation";

  return (
    <div className="border-border mt-3 flex flex-col gap-2 rounded-lg border p-3">
      <span className={ETIQUETTE}>{attendu === "image" ? "Image" : "Document"}</span>

      <LienFichier contributionId={contributionId} aUnFichier={aUnFichier} />

      <input
        ref={champ}
        type="file"
        accept={accept}
        aria-label="Choisir un fichier"
        onChange={(evenement) => void envoyer(evenement)}
        className="text-text-2 text-sm"
      />
      <span className="text-text-3 text-xs">
        {attendu === "image"
          ? "PNG, JPEG, WebP ou SVG."
          : `PDF ou PPTX, ${DOCUMENT_MAX_BYTES / 1024 / 1024} Mo maximum.`}{" "}
        L&apos;envoi part dès que le fichier est choisi.
      </span>

      {enCours && <span className="text-text-3 text-xs">Envoi en cours…</span>}
      {etat && (
        <span
          role="status"
          className={`text-xs ${etat.ton === "erreur" ? "text-danger-text" : "text-accent-text"}`}
        >
          {etat.texte}
        </span>
      )}
    </div>
  );
}

function LienFichier({
  contributionId,
  aUnFichier,
}: {
  contributionId: string;
  aUnFichier: boolean;
}) {
  return aUnFichier ? (
    <a
      href={`/api/v1/contributions/${contributionId}/fichier`}
      className="text-link inline-flex w-fit items-center gap-2 text-sm font-semibold"
    >
      <FileText aria-hidden size={15} />
      Fichier déposé — ouvrir
    </a>
  ) : (
    <span className="text-text-3 text-sm">Aucun fichier.</span>
  );
}

/** Champs communs à la création et à la modification. */
function Champs({
  valeurs,
  intervenants,
  niveau,
  consentement,
}: {
  valeurs: Partial<Contribution>;
  intervenants: IntervenantChoix[];
  niveau: NiveauGestion;
  /** Accord de l'intervenant, pour une présentation qu'il a déposée. */
  consentement: boolean;
}) {
  const [type, setType] = useState<TypeContribution>(
    (valeurs.type as TypeContribution) ?? "SYNTHESIS",
  );
  const modele = MODELES[type];
  const identifiant = valeurs.id ?? "nouvelle";

  /*
   * Présentation déposée par un intervenant : son type et son auteur sont
   * figés, parce que l'accord de publication porte sur ce support et cette
   * personne. Le service l'impose de toute façon ; l'écran le montre.
   */
  const deposee = valeurs.origine === "INTERVENANT";

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${identifiant}-type`} className={ETIQUETTE}>
            Type
          </label>
          <select
            id={`${identifiant}-type`}
            name={deposee ? undefined : "type"}
            value={type}
            disabled={deposee}
            onChange={(evenement) => setType(evenement.target.value as TypeContribution)}
            className={CHAMP}
          >
            {TYPES_CONTRIBUTION.map((cle) => (
              <option key={cle} value={cle}>
                {MODELES[cle].label}
              </option>
            ))}
          </select>
          {deposee && <input type="hidden" name="type" value={type} />}
          <span className="text-text-3 text-xs">{modele.description}</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${identifiant}-title`} className={ETIQUETTE}>
            Titre
          </label>
          <input
            id={`${identifiant}-title`}
            name="title"
            defaultValue={valeurs.title ?? ""}
            maxLength={200}
            required
            className={CHAMP}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        <label htmlFor={`${identifiant}-body`} className={ETIQUETTE}>
          Texte
        </label>
        <textarea
          id={`${identifiant}-body`}
          name="body"
          defaultValue={valeurs.body ?? ""}
          rows={4}
          maxLength={20_000}
          className={CHAMP}
        />
      </div>

      {modele.lien && (
        <div className="mt-3 flex flex-col gap-1.5">
          <label htmlFor={`${identifiant}-url`} className={ETIQUETTE}>
            Lien vidéo
          </label>
          <input
            id={`${identifiant}-url`}
            name="url"
            type="url"
            defaultValue={valeurs.url ?? ""}
            placeholder="https://www.youtube.com/watch?v=…"
            className={CHAMP}
          />
          <span className="text-text-3 flex items-center gap-1.5 text-xs">
            <Link2 aria-hidden size={12} />
            YouTube ou Vimeo. La vidéo n&apos;est pas hébergée ici.
          </span>
        </div>
      )}
      {!modele.lien && <input type="hidden" name="url" value="" />}

      {intervenants.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5">
          <label htmlFor={`${identifiant}-speaker`} className={ETIQUETTE}>
            Intervenant (facultatif)
          </label>
          <select
            id={`${identifiant}-speaker`}
            name={deposee ? undefined : "speakerId"}
            defaultValue={valeurs.speakerId ?? ""}
            disabled={deposee}
            className={CHAMP}
          >
            <option value="">—</option>
            {intervenants.map((personne) => (
              <option key={personne.id} value={personne.id}>
                {personne.nom}
              </option>
            ))}
          </select>
        </div>
      )}
      {deposee && <input type="hidden" name="speakerId" value={valeurs.speakerId ?? ""} />}

      {niveau === "rapporteur" ? (
        <p className="text-text-3 mt-3 flex items-center gap-1.5 text-xs">
          <Lock aria-hidden size={12} />
          Le gestionnaire programme publie après relecture.
        </p>
      ) : (
        <>
          <label
            htmlFor={`${identifiant}-publie`}
            className="text-text-2 mt-3 flex items-center gap-2 text-sm"
          >
            <input
              id={`${identifiant}-publie`}
              type="checkbox"
              name="isPublished"
              defaultChecked={valeurs.isPublished ?? false}
              disabled={deposee && !consentement}
            />
            Publier sur le site
          </label>
          {deposee && !consentement && (
            <p className="text-text-3 mt-1 text-xs">
              L&apos;intervenant n&apos;a pas encore autorisé la publication de sa présentation. Il
              le fait depuis son espace.
            </p>
          )}
        </>
      )}
    </>
  );
}

function Retour({ etat }: { etat: EtatAction }) {
  if (etat.erreur) {
    return (
      <p role="status" className="text-danger-text mt-3 text-sm">
        {etat.erreur}
      </p>
    );
  }
  if (etat.avis) {
    return (
      <p role="status" className="text-accent-text mt-3 flex items-center gap-1.5 text-sm">
        <Check aria-hidden size={15} />
        {etat.avis}
      </p>
    );
  }
  return null;
}

function CarteContribution({
  contribution,
  intervenants,
  niveau,
  consentement,
}: {
  contribution: Contribution;
  intervenants: IntervenantChoix[];
  niveau: NiveauGestion;
  consentement: boolean;
}) {
  const [etat, action, enCours] = useActionState(
    modifierContributionAction.bind(null, contribution.id),
    etatInitial,
  );
  const { soumettre } = useSoumissionSansRemiseAZero(action);
  const [erreur, setErreur] = useState<string | null>(null);
  const [transitionEnCours, startTransition] = useTransition();
  const router = useRouter();
  const modele = MODELES[contribution.type as TypeContribution];

  // Les mêmes règles que le service, pour n'afficher que les gestes permis. Le
  // service les rejoue : masquer un bouton n'a jamais protégé personne.
  const modification = peutModifier(niveau, contribution);
  const ordonnable = peutOrdonner(niveau).autorise;
  const deposee = contribution.origine === "INTERVENANT";

  // Après un enregistrement réussi, l'écran relit la base : le badge
  // « Publiée » ou « Brouillon » doit refléter ce qui vient d'être décidé.
  useEffect(() => {
    if (etat.avis) router.refresh();
  }, [etat, router]);

  function agir(promesse: Promise<EtatAction>) {
    setErreur(null);
    startTransition(async () => {
      const resultat = await promesse;
      if (resultat.erreur) setErreur(resultat.erreur);
      else router.refresh();
    });
  }

  return (
    <div
      data-testid="carte-contribution"
      data-type={contribution.type}
      data-id={contribution.id}
      className="border-border bg-surface rounded-xl border p-5"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className={`bg-blue-soft text-blue-text ${PASTILLE}`}>{modele.label}</span>
        {contribution.isPublished ? (
          <span className={`bg-accent-soft text-accent-text ${PASTILLE}`}>Publiée</span>
        ) : (
          <span className="text-text-3 border-border rounded-md border px-2 py-0.5 text-xs">
            Brouillon
          </span>
        )}
        {contribution.origine === "RAPPORTEUR" && (
          <span className="text-text-2 border-border rounded-md border px-2 py-0.5 text-xs">
            Rédigée par un rapporteur
          </span>
        )}
        {deposee && (
          <span className="text-text-2 border-border rounded-md border px-2 py-0.5 text-xs">
            Déposée par l&apos;intervenant
          </span>
        )}
        {deposee &&
          (consentement ? (
            <span className={`bg-accent-soft text-accent-text ${PASTILLE}`}>
              Publication autorisée
            </span>
          ) : (
            <span className={`bg-danger-soft text-danger-text ${PASTILLE}`}>
              Accord de l&apos;intervenant manquant
            </span>
          ))}

        {(ordonnable || modification.autorise) && (
          <span className="ml-auto flex items-center gap-1">
            {ordonnable && (
              <>
                <Bouton
                  ton="discret"
                  taille="petit"
                  icone={ArrowUp}
                  titre="Monter"
                  type="button"
                  disabled={transitionEnCours}
                  onClick={() => agir(deplacerContributionAction(contribution.id, "haut"))}
                />
                <Bouton
                  ton="discret"
                  taille="petit"
                  icone={ArrowDown}
                  titre="Descendre"
                  type="button"
                  disabled={transitionEnCours}
                  onClick={() => agir(deplacerContributionAction(contribution.id, "bas"))}
                />
              </>
            )}
            {modification.autorise && (
              <Bouton
                ton="danger"
                taille="petit"
                icone={Trash2}
                titre="Supprimer"
                type="button"
                disabled={transitionEnCours}
                onClick={auClicConfirme(
                  {
                    titre: "Supprimer cette contribution ?",
                    texte: `« ${contribution.title} » disparaîtra du site et le fichier déposé sera effacé.`,
                    confirmer: "Supprimer",
                    ton: "danger",
                  },
                  () => agir(supprimerContributionAction(contribution.id)),
                )}
              />
            )}
          </span>
        )}
      </div>

      {modification.autorise ? (
        <form onSubmit={soumettre}>
          <Champs
            valeurs={contribution}
            intervenants={intervenants}
            niveau={niveau}
            consentement={consentement}
          />
          <Bouton ton="principal" icone={Save} type="submit" disabled={enCours} className="mt-4">
            {enCours ? "Enregistrement…" : "Enregistrer"}
          </Bouton>
        </form>
      ) : (
        <div>
          <h3 className="text-heading text-base font-semibold">{contribution.title}</h3>
          {contribution.body && (
            <p className="text-text-2 mt-2 line-clamp-4 text-sm whitespace-pre-line">
              {contribution.body}
            </p>
          )}
          <p className="text-text-3 mt-3 flex items-start gap-1.5 text-xs">
            <Lock aria-hidden size={12} className="mt-0.5 shrink-0" />
            {modification.raison}
          </p>
        </div>
      )}

      <Retour etat={etat} />
      {erreur && (
        <p role="status" className="text-danger-text mt-3 text-sm">
          {erreur}
        </p>
      )}

      {modele.fichier !== "aucun" &&
        (modification.autorise && !deposee ? (
          <DepotFichier
            contributionId={contribution.id}
            aUnFichier={Boolean(contribution.filePath)}
            attendu={modele.fichier}
          />
        ) : (
          <div className="border-border mt-3 flex flex-col gap-1.5 rounded-lg border p-3">
            <LienFichier
              contributionId={contribution.id}
              aUnFichier={Boolean(contribution.filePath)}
            />
            {deposee && (
              <span className="text-text-3 text-xs">
                Ce support se remplace depuis l&apos;espace de l&apos;intervenant.
              </span>
            )}
          </div>
        ))}
    </div>
  );
}

/**
 * Rapporteurs rattachés à la session, pour le gestionnaire.
 *
 * Sans formulaire : une liste et un bouton, en transition. Un `<form action>`
 * se remettrait à zéro après chaque envoi, refus compris (§14.5).
 */
export function RapporteursSession({
  sessionId,
  rattaches,
  disponibles,
}: {
  sessionId: string;
  rattaches: CompteChoix[];
  disponibles: CompteChoix[];
}) {
  const [choix, setChoix] = useState("");
  const [retour, setRetour] = useState<EtatAction>({});
  const [enCours, startTransition] = useTransition();
  const router = useRouter();

  const proposables = disponibles.filter(
    (compte) => !rattaches.some((rattache) => rattache.id === compte.id),
  );

  function agir(appel: () => Promise<EtatAction>) {
    setRetour({});
    startTransition(async () => {
      const resultat = await appel();
      setRetour(resultat);
      if (!resultat.erreur) {
        setChoix("");
        router.refresh();
      }
    });
  }

  return (
    <section
      aria-labelledby="titre-rapporteurs"
      className="border-border bg-surface rounded-xl border p-5"
    >
      <h3 id="titre-rapporteurs" className="text-heading text-sm font-semibold">
        Rapporteurs de la session
      </h3>
      <p className="text-text-3 mt-1 text-xs">
        Un rapporteur rédige les contributions de cette session, sans pouvoir les publier. Il ne
        voit que les sessions auxquelles il est rattaché.
      </p>

      {rattaches.length === 0 ? (
        <p className="text-text-3 mt-3 text-sm">Aucun rapporteur rattaché.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {rattaches.map((compte) => (
            <li
              key={compte.id}
              className="border-border flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
            >
              <span className="text-sm">
                <span className="text-heading font-medium">{compte.nom}</span>{" "}
                <span className="text-text-3">· {compte.email}</span>
              </span>
              <Bouton
                ton="discret"
                taille="petit"
                icone={UserMinus}
                type="button"
                disabled={enCours}
                onClick={() => agir(() => retirerRapporteurAction(sessionId, compte.id))}
              >
                Retirer
              </Bouton>
            </li>
          ))}
        </ul>
      )}

      {proposables.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label htmlFor="rapporteur-a-rattacher" className={ETIQUETTE}>
              Rattacher un rapporteur
            </label>
            <select
              id="rapporteur-a-rattacher"
              value={choix}
              onChange={(evenement) => setChoix(evenement.target.value)}
              className={CHAMP}
            >
              <option value="">Choisir un compte…</option>
              {proposables.map((compte) => (
                <option key={compte.id} value={compte.id}>
                  {compte.nom} — {compte.email}
                </option>
              ))}
            </select>
          </div>
          <Bouton
            ton="principal"
            icone={UserPlus}
            type="button"
            disabled={!choix || enCours}
            onClick={() => agir(() => rattacherRapporteurAction(sessionId, choix))}
          >
            Rattacher
          </Bouton>
        </div>
      ) : (
        <p className="text-text-3 mt-4 text-xs">
          {disponibles.length === 0
            ? "Aucun compte n'a le rôle Rapporteur. Un administrateur en crée un depuis Pilotage → Utilisateurs."
            : "Tous les comptes rapporteurs sont déjà rattachés à cette session."}
        </p>
      )}

      <Retour etat={retour} />
    </section>
  );
}

export function GestionContributions({
  sessionId,
  contributions,
  intervenants,
  niveau,
  consentements,
}: {
  sessionId: string;
  contributions: Contribution[];
  intervenants: IntervenantChoix[];
  niveau: NiveauGestion;
  /** Accord de publication, par identifiant d'intervenant. */
  consentements: Record<string, boolean>;
}) {
  const [etat, action, enCours] = useActionState(creerContributionAction, etatInitial);
  const { soumettre } = useSoumissionSansRemiseAZero(action);

  return (
    <div className="flex flex-col gap-4">
      <details className="border-border bg-surface rounded-xl border p-5">
        <summary className="text-heading cursor-pointer text-sm font-semibold">
          Ajouter une contribution
        </summary>
        <form onSubmit={soumettre} className="mt-4">
          <input type="hidden" name="sessionId" value={sessionId} />
          {/* La clé change à chaque ajout réussi : les champs repartent vides,
              type compris. Un refus ne la change pas, et laisse donc la saisie
              intacte. */}
          <Champs
            key={etat.jeton ?? 0}
            valeurs={{}}
            intervenants={intervenants}
            niveau={niveau}
            consentement={false}
          />
          <Bouton ton="principal" icone={Plus} type="submit" disabled={enCours} className="mt-4">
            {enCours ? "Ajout…" : "Ajouter"}
          </Bouton>
        </form>
        <Retour etat={etat} />
        <p className="text-text-3 mt-3 flex items-start gap-2 text-xs">
          <Upload aria-hidden size={13} className="mt-0.5 shrink-0" />
          Le fichier se dépose après la création, sur la carte de la contribution.
        </p>
      </details>

      {contributions.length === 0 ? (
        <p className="border-border bg-surface text-text-3 rounded-xl border p-5 text-sm">
          Aucune contribution pour cette session.
        </p>
      ) : (
        contributions.map((contribution) => (
          <CarteContribution
            key={contribution.id}
            contribution={contribution}
            intervenants={intervenants}
            niveau={niveau}
            consentement={
              contribution.speakerId ? (consentements[contribution.speakerId] ?? false) : false
            }
          />
        ))
      )}
    </div>
  );
}
