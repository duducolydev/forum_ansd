"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  finaliserAction,
  inscrireSurPlaceAction,
  noterImpressionAction,
  rechercherAction,
  type AccueilState,
} from "../actions";
import type { Candidat, ResultatAccueil } from "../service";
import { WebcamCapture } from "./webcam-capture";
import { useDocumentAvecCamera } from "@/lib/camera-document";
import { ArrowLeft, ArrowRight, Printer, UserCheck, UserPlus } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";

const champ = "border-border bg-bg text-text w-full rounded-lg border px-3 py-2.5 text-sm";
const etiquette = "text-text-3 text-xs font-semibold";

const STATUT_LABEL: Record<string, string> = {
  INVITED: "Invité",
  INVITATION_SENT: "Invitation envoyée",
  REGISTRATION_STARTED: "Inscription commencée",
  REGISTERED: "Inscrit, à valider",
  CONFIRMED: "Confirmé",
  BADGED: "Badge émis",
  CHECKED_IN: "Déjà entré",
};

/**
 * Comptoir d'accueil (brief §5.7) — un seul écran.
 *
 * Recherche, création, validation, badge, impression et présence tiennent sur
 * la même page, sans navigation : la cible est de **moins de 90 secondes par
 * personne**, et chaque changement de page en coûte plusieurs.
 *
 * La recherche part au fil de la frappe, avec un délai de 250 ms. Un bouton
 * « Rechercher » obligerait à quitter le clavier ; à trois lettres près, la
 * bonne personne est déjà à l'écran.
 */
export function OnsiteDesk({
  categories,
  checkpoints,
}: {
  categories: { id: string; labelFr: string }[];
  checkpoints: { id: string; name: string; zoneCode: string }[];
}) {
  const [terme, setTerme] = useState("");
  const [candidats, setCandidats] = useState<Candidat[]>([]);
  const [checkpointId, setCheckpointId] = useState(checkpoints[0]?.id ?? "");
  const [resultat, setResultat] = useState<ResultatAccueil | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [mode, setMode] = useState<"RECHERCHE" | "CREATION">("RECHERCHE");
  const [photo, setPhoto] = useState<File | null>(null);
  const [enCours, startTransition] = useTransition();
  const [creation, setCreation] = useState<AccueilState>({});
  const [creationEnCours, setCreationEnCours] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const rechercheRef = useRef<HTMLInputElement>(null);

  // La photo par webcam : même filet que le scanner (PLAN.md §16). Au montage,
  // rien n'est encore saisi, un rechargement ne fait rien perdre.
  useDocumentAvecCamera();

  useEffect(() => {
    if (checkpointId) localStorage.setItem("accueil.checkpoint", checkpointId);
  }, [checkpointId]);

  useEffect(() => {
    const memorise = localStorage.getItem("accueil.checkpoint");
    if (memorise && checkpoints.some((point) => point.id === memorise)) setCheckpointId(memorise);
  }, [checkpoints]);

  useEffect(() => {
    let vivant = true;
    const timer = setTimeout(async () => {
      if (terme.trim().length < 2) {
        setCandidats([]);
        return;
      }
      const { candidats: trouves } = await rechercherAction(terme);
      if (vivant) setCandidats(trouves);
    }, 250);
    return () => {
      vivant = false;
      clearTimeout(timer);
    };
  }, [terme]);

  const recommencer = useCallback(() => {
    setResultat(null);
    setErreur(null);
    setTerme("");
    setCandidats([]);
    setPhoto(null);
    setCreation({});
    setMode("RECHERCHE");
    formRef.current?.reset();
    rechercheRef.current?.focus();
  }, []);

  function finaliserCandidat(participantId: string) {
    setErreur(null);
    startTransition(async () => {
      const etat = await finaliserAction(participantId, checkpointId || null);
      if (etat.error) setErreur(etat.error);
      else if (etat.resultat) setResultat(etat.resultat);
    });
  }

  /*
   * FormData construite à la main puis passée à l'action.
   *
   * Le formulaire porte un champ fichier alimenté par la webcam, qui n'existe
   * dans aucun `<input type="file">` : il faut donc l'ajouter nous-mêmes. C'est
   * aussi le motif retenu au formulaire d'inscription public, où laisser React
   * sérialiser sa propre vue des champs avait fait perdre les consentements.
   */
  function creer(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (!formRef.current) return;

    const donnees = new FormData(formRef.current);
    donnees.set("checkpointId", checkpointId);
    if (photo) donnees.set("photo", photo);

    setCreationEnCours(true);
    startTransition(async () => {
      const etat = await inscrireSurPlaceAction({}, donnees);
      setCreationEnCours(false);
      setCreation(etat);
      if (etat.resultat) setResultat(etat.resultat);
    });
  }

  // --- Écran de résultat ---------------------------------------------------
  if (resultat) {
    return (
      <div className="border-border bg-surface flex flex-col gap-4 rounded-xl border p-6">
        <div>
          <p className="text-accent-text text-sm font-semibold">
            {resultat.badgeExistant ? "Badge déjà émis" : "Badge généré"}
            {resultat.presenceEnregistree ? " · présence enregistrée" : " · présence non notée"}
          </p>
          <h3 className="text-heading mt-1 text-2xl">{resultat.nom}</h3>
          <p className="text-text-3 font-mono text-sm">{resultat.publicId}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <a
            href={`/api/v1/badges/${resultat.badgeId}/pdf`}
            target="_blank"
            rel="noopener"
            onClick={() => void noterImpressionAction(resultat.badgeId)}
            className="bg-primary text-primary-text hover:bg-primary-hover rounded-lg px-5 py-2.5 text-sm font-semibold no-underline"
          >
            Imprimer le badge
          </a>
          <a
            href={`/admin/participants/${resultat.participantId}`}
            className="border-border text-heading rounded-lg border px-4 py-2.5 text-sm font-semibold no-underline"
          >
            Ouvrir la fiche
          </a>
          <Bouton ton="secondaire" icone={ArrowRight} type="button" onClick={recommencer}>
            Personne suivante
          </Bouton>
        </div>

        {!resultat.presenceEnregistree && (
          <p className="text-text-3 text-xs">
            Aucun point de contrôle sélectionné, ou passage déjà enregistré : la présence n&apos;a
            pas été ajoutée deux fois.
          </p>
        )}
      </div>
    );
  }

  // --- Recherche et création ----------------------------------------------
  return (
    <div className="flex flex-col gap-5">
      <div className="border-border bg-surface flex flex-wrap items-end gap-3 rounded-xl border p-4">
        <div className="min-w-56 flex-1">
          <label htmlFor="recherche" className={etiquette}>
            Nom, e-mail, téléphone, organisation ou identifiant
          </label>
          <input
            id="recherche"
            ref={rechercheRef}
            autoFocus
            value={terme}
            onChange={(evenement) => setTerme(evenement.target.value)}
            placeholder="Sow, ANSD, FID26-…"
            className={`${champ} mt-1.5`}
          />
        </div>
        <div>
          <label htmlFor="checkpoint" className={etiquette}>
            Point de contrôle
          </label>
          <select
            id="checkpoint"
            value={checkpointId}
            onChange={(evenement) => setCheckpointId(evenement.target.value)}
            className={`${champ} mt-1.5 w-56`}
          >
            <option value="">Sans enregistrement de présence</option>
            {checkpoints.map((point) => (
              <option key={point.id} value={point.id}>
                {point.name} — {point.zoneCode}
              </option>
            ))}
          </select>
        </div>
      </div>

      {erreur && <p className="text-danger-text text-sm">{erreur}</p>}

      {mode === "RECHERCHE" && (
        <>
          {candidats.length > 0 && (
            <ul className="flex flex-col gap-2">
              {candidats.map((candidat) => (
                <li
                  key={candidat.id}
                  className="border-border bg-surface flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border p-3.5"
                >
                  <span className="min-w-48 flex-1">
                    <span className="text-heading block font-semibold">{candidat.nom}</span>
                    <span className="text-text-3 text-xs">
                      {candidat.publicId} · {candidat.categorie}
                      {candidat.organisation ? ` · ${candidat.organisation}` : ""} ·{" "}
                      {STATUT_LABEL[candidat.statut] ?? candidat.statut}
                    </span>
                  </span>
                  <Bouton
                    ton="principal"
                    icone={Printer}
                    type="button"
                    disabled={enCours}
                    onClick={() => finaliserCandidat(candidat.id)}
                  >
                    {enCours ? "…" : candidat.aBadge ? "Réimprimer et entrer" : "Valider et badger"}
                  </Bouton>
                </li>
              ))}
            </ul>
          )}

          {terme.trim().length >= 2 && candidats.length === 0 && (
            <p className="text-text-2 text-sm">Personne ne correspond à cette recherche.</p>
          )}

          <Bouton
            ton="secondaire"
            icone={UserPlus}
            type="button"
            onClick={() => setMode("CREATION")}
            className="self-start"
          >
            Nouvelle inscription
          </Bouton>
        </>
      )}

      {mode === "CREATION" && (
        <form
          ref={formRef}
          onSubmit={creer}
          className="border-border bg-surface flex flex-col gap-4 rounded-xl border p-5"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-heading text-sm font-semibold">Nouvelle inscription</h3>
            <Bouton
              ton="discret"
              taille="petit"
              icone={ArrowLeft}
              type="button"
              onClick={() => setMode("RECHERCHE")}
            >
              Revenir à la recherche
            </Bouton>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label htmlFor="civility" className={etiquette}>
                Civilité
              </label>
              <select id="civility" name="civility" className={`${champ} mt-1.5`}>
                <option value="">—</option>
                <option value="M.">M.</option>
                <option value="Mme">Mme</option>
                <option value="Dr">Dr</option>
                <option value="Pr">Pr</option>
              </select>
            </div>
            <div>
              <label htmlFor="firstName" className={etiquette}>
                Prénom *
              </label>
              <input id="firstName" name="firstName" required className={`${champ} mt-1.5`} />
            </div>
            <div>
              <label htmlFor="lastName" className={etiquette}>
                Nom *
              </label>
              <input id="lastName" name="lastName" required className={`${champ} mt-1.5`} />
            </div>
            <div>
              <label htmlFor="email" className={etiquette}>
                E-mail
              </label>
              <input id="email" name="email" type="email" className={`${champ} mt-1.5`} />
            </div>
            <div>
              <label htmlFor="phone" className={etiquette}>
                Téléphone
              </label>
              <input id="phone" name="phone" className={`${champ} mt-1.5`} />
            </div>
            <div>
              <label htmlFor="organization" className={etiquette}>
                Organisation
              </label>
              <input id="organization" name="organization" className={`${champ} mt-1.5`} />
            </div>
            <div>
              <label htmlFor="country" className={etiquette}>
                Pays *
              </label>
              <input
                id="country"
                name="country"
                required
                defaultValue="Sénégal"
                className={`${champ} mt-1.5`}
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="categoryId" className={etiquette}>
                Catégorie *
              </label>
              <select id="categoryId" name="categoryId" required className={`${champ} mt-1.5`}>
                {categories.map((categorie) => (
                  <option key={categorie.id} value={categorie.id}>
                    {categorie.labelFr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <span className={etiquette}>Photo (facultative)</span>
            <div className="mt-2">
              <WebcamCapture onCapture={setPhoto} />
            </div>
          </div>

          <p className="text-text-3 text-xs">
            E-mail ou téléphone : au moins l&apos;un des deux. Le reste du dossier se complète plus
            tard depuis la fiche.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Bouton
              ton="principal"
              icone={UserCheck}
              type="submit"
              disabled={creationEnCours || enCours}
            >
              {creationEnCours ? "Création…" : "Inscrire, badger et faire entrer"}
            </Bouton>
            {creation.error && <p className="text-danger-text text-sm">{creation.error}</p>}
          </div>
        </form>
      )}
    </div>
  );
}
