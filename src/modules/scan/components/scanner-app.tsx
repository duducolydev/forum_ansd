"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import type { EntreeManifeste } from "../manifest";
import type { MetaManifeste } from "../client/store";
import { chercherEmpreinte, compterFile, lireMeta, rechercher } from "../client/store";
import { empreinteToken, extraireToken } from "../client/token";
import { traiterScan, type ResultatScan } from "../client/verdict";
import { envoyerFile, synchroniserManifeste } from "../client/sync";
import { documentAutoriseLaCamera, useDocumentAvecCamera } from "@/lib/camera-document";

/** Rafraîchissement du manifeste (brief §5.6). */
const PERIODE_SYNC_MS = 10 * 60 * 1000;
/** Tentative d'envoi de la file, plus fréquente : elle contient des présences. */
const PERIODE_ENVOI_MS = 30 * 1000;
/** Décodage limité : inutile d'analyser 60 images par seconde pour un QR. */
const PERIODE_DECODAGE_MS = 120;

/**
 * Zone retenue par défaut à l'ouverture du scanner.
 *
 * Le gros du travail se fait à l'entrée : c'est là que tout le monde passe, et
 * que les appareils sont les plus nombreux. Prendre le premier point de la
 * liste, classée par nom, désignait un point de salle au hasard de
 * l'alphabet — un agent d'accueil enregistrait alors ses passages sur la
 * mauvaise porte sans rien remarquer.
 *
 * Ce code est celui du seed, et il est stable (`prisma/seed.ts`). S'il venait à
 * disparaître d'une édition, la sélection retombe sur le premier point.
 */
const ZONE_PAR_DEFAUT = "ENTREE";

const COULEURS = {
  VERT: "bg-[#0F7B3E] text-white",
  ORANGE: "bg-[#B45309] text-white",
  ROUGE: "bg-[#9B1C22] text-white",
} as const;

/** Durée d'affichage : un refus reste plus longtemps, l'agent doit le lire. */
const DUREE_VERDICT_MS = { VERT: 2500, ORANGE: 4000, ROUGE: 5000 } as const;

function bip(couleur: keyof typeof COULEURS) {
  try {
    const contexte = new AudioContext();
    const oscillateur = contexte.createOscillator();
    const gain = contexte.createGain();
    oscillateur.connect(gain);
    gain.connect(contexte.destination);
    // Grave pour un refus, aigu pour une autorisation : distinguable sans
    // regarder l'écran, dans le bruit d'un hall d'accueil.
    oscillateur.frequency.value = couleur === "ROUGE" ? 220 : couleur === "ORANGE" ? 440 : 880;
    gain.gain.setValueAtTime(0.15, contexte.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, contexte.currentTime + 0.25);
    oscillateur.start();
    oscillateur.stop(contexte.currentTime + 0.25);
    setTimeout(() => void contexte.close(), 400);
  } catch {
    // Le son est un confort : son échec ne doit jamais interrompre un scan.
  }
  try {
    navigator.vibrate?.(couleur === "VERT" ? 80 : [80, 60, 80]);
  } catch {
    /* idem */
  }
}

/**
 * Pourquoi la caméra ne s'allume pas, dit à l'agent (PLAN.md §16).
 *
 * « Caméra indisponible » seul ne permettait pas d'agir : un refus d'autorisation
 * se règle dans le navigateur, une caméra occupée en fermant l'autre application,
 * une adresse en http:// en passant par https://. Chaque cause a son geste.
 */
type CauseCamera = "POLITIQUE" | "REFUS" | "ABSENTE" | "OCCUPEE" | "NON_SECURISE" | "INCONNUE";

const MESSAGES_CAMERA: Record<CauseCamera, string> = {
  POLITIQUE: "Cette page n'a pas encore le droit d'utiliser la caméra : rechargez-la.",
  REFUS:
    "Accès à la caméra refusé. Autorisez-le dans les réglages du navigateur (icône à gauche de l'adresse), puis réessayez.",
  ABSENTE: "Aucune caméra détectée sur cet appareil.",
  OCCUPEE:
    "La caméra est déjà utilisée par une autre application ou un autre onglet. Libérez-la, puis réessayez.",
  NON_SECURISE:
    "La caméra exige une connexion sécurisée : ouvrez le scanner par son adresse en https://.",
  INCONNUE: "Caméra indisponible.",
};

function identifierCause(erreur: unknown): CauseCamera {
  if (!window.isSecureContext) return "NON_SECURISE";
  if (documentAutoriseLaCamera() === false) return "POLITIQUE";
  const nom = erreur instanceof Error ? erreur.name : "";
  if (nom === "NotAllowedError" || nom === "SecurityError") return "REFUS";
  if (nom === "NotFoundError" || nom === "OverconstrainedError") return "ABSENTE";
  if (nom === "NotReadableError" || nom === "AbortError") return "OCCUPEE";
  return "INCONNUE";
}

export function ScannerApp({ nomAgent }: { nomAgent: string }) {
  // Filet : arrivé ici par une navigation interne, le document peut encore
  // porter la politique d'une page qui refuse la caméra (PLAN.md §16).
  useDocumentAvecCamera();

  const [meta, setMeta] = useState<MetaManifeste | null>(null);
  const [checkpointId, setCheckpointId] = useState<string>("");
  const [enFile, setEnFile] = useState(0);
  const [enLigne, setEnLigne] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [resultat, setResultat] = useState<ResultatScan | null>(null);
  const [camera, setCamera] = useState<"ETEINTE" | "ACTIVE" | "REFUSEE">("ETEINTE");
  const [cause, setCause] = useState<CauseCamera>("INCONNUE");
  const [essaiCamera, setEssaiCamera] = useState(0);
  const [recherche, setRecherche] = useState("");
  const [trouves, setTrouves] = useState<EntreeManifeste[]>([]);
  const [panneau, setPanneau] = useState<"CAMERA" | "RECHERCHE">("CAMERA");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fluxRef = useRef<MediaStream | null>(null);
  const traitementRef = useRef(false);

  const point = meta?.checkpoints.find((candidat) => candidat.id === checkpointId) ?? null;

  /*
   * Avertissement permanent plutôt que message à la première tentative :
   * l'agent doit savoir que l'appareil n'enregistrera rien **avant** d'avoir
   * laissé passer quelqu'un, et non après.
   *
   * Les deux cas appellent des gestes différents. Une liste vide se règle dans
   * le BackOffice et se termine par une synchronisation ; une liste garnie mais
   * sans sélection se règle sur place, dans le sélecteur juste au-dessus.
   *
   * Conditionné à `meta` : tant que le manifeste n'est pas lu, l'absence de
   * point ne veut rien dire et le bandeau clignoterait au démarrage.
   */
  const sansPoint =
    meta && !point
      ? meta.checkpoints.length === 0
        ? "Aucun point de contrôle actif. Créez-en un dans le BackOffice, page des zones d'accès, puis appuyez sur Synchroniser."
        : "Choisissez un point de contrôle ci-dessus : aucun passage ne sera enregistré tant qu'il n'est pas défini."
      : null;

  const rafraichirCompteurs = useCallback(async () => {
    setEnFile(await compterFile());
    setMeta(await lireMeta());
  }, []);

  // --- Chargement initial et synchronisations périodiques ------------------
  useEffect(() => {
    let vivant = true;

    async function demarrer() {
      const etat = await synchroniserManifeste();
      if (!vivant) return;
      if (etat.etat === "ERREUR") setMessage(etat.message);
      if (etat.etat === "HORS_LIGNE") setEnLigne(false);

      const chargee = await lireMeta();
      if (!vivant) return;
      setMeta(chargee);

      // Le choix de l'agent prime — il a posé son appareil à une porte précise
      // et n'a pas à le redire à chaque ouverture. À défaut, l'entrée.
      const memorise = localStorage.getItem("scan.checkpoint");
      const valide = chargee?.checkpoints.some((candidat) => candidat.id === memorise);
      const parDefaut =
        chargee?.checkpoints.find((candidat) => candidat.zoneCode === ZONE_PAR_DEFAUT) ??
        chargee?.checkpoints[0];
      setCheckpointId(valide && memorise ? memorise : (parDefaut?.id ?? ""));
      setEnFile(await compterFile());
    }

    void demarrer();

    const surLigne = () => setEnLigne(true);
    const surCoupure = () => setEnLigne(false);
    window.addEventListener("online", surLigne);
    window.addEventListener("offline", surCoupure);
    setEnLigne(navigator.onLine);

    const timerManifeste = setInterval(() => void synchroniserManifeste(), PERIODE_SYNC_MS);
    const timerEnvoi = setInterval(async () => {
      const envoi = await envoyerFile();
      setEnLigne(!envoi.horsLigne);
      if (envoi.envoyes > 0) setEnFile(await compterFile());
    }, PERIODE_ENVOI_MS);

    return () => {
      vivant = false;
      window.removeEventListener("online", surLigne);
      window.removeEventListener("offline", surCoupure);
      clearInterval(timerManifeste);
      clearInterval(timerEnvoi);
    };
  }, []);

  useEffect(() => {
    if (checkpointId) localStorage.setItem("scan.checkpoint", checkpointId);
  }, [checkpointId]);

  // --- Traitement d'un badge ----------------------------------------------
  const scanner = useCallback(
    async (empreinte: string, entree: EntreeManifeste | null) => {
      if (traitementRef.current) return;

      /*
       * Un passage se rattache à une porte : sans point de contrôle, il n'a
       * nulle part où s'inscrire. Le traitement sortait ici **en silence**, et
       * l'agent enchaînait les badges devant un écran immobile, sans rien pour
       * le mettre sur la voie. Constaté le 25 septembre 2026, sur une base où
       * aucun point n'avait encore été créé — le seed n'en posait aucun.
       *
       * Le bandeau permanent explique quoi faire ; ce message-ci répond à la
       * tentative elle-même, et dit surtout ce qui compte : rien n'a été
       * enregistré.
       */
      if (!point) {
        setMessage(
          "Badge lu, mais aucun point de contrôle n'est choisi : rien n'a été enregistré.",
        );
        return;
      }

      traitementRef.current = true;

      try {
        const issue = await traiterScan(empreinte, entree, point.id, point.zoneCode);
        setResultat(issue);
        bip(issue.verdict.couleur);
        setEnFile(await compterFile());

        // Envoi immédiat quand le réseau est là : la file n'est un tampon que
        // pour les coupures, pas un mode de fonctionnement normal.
        if (navigator.onLine) {
          void envoyerFile().then(async (envoi) => {
            setEnLigne(!envoi.horsLigne);
            setEnFile(await compterFile());
          });
        }
      } finally {
        traitementRef.current = false;
      }
    },
    [point],
  );

  const scannerDepuisQr = useCallback(
    async (contenu: string) => {
      const token = extraireToken(contenu);
      if (!token) {
        setMessage("QR non reconnu — utilisez la recherche manuelle.");
        return;
      }
      const empreinte = await empreinteToken(token);
      await scanner(empreinte, await chercherEmpreinte(empreinte));
    },
    [scanner],
  );

  // --- Caméra --------------------------------------------------------------
  useEffect(() => {
    if (panneau !== "CAMERA" || resultat) return;

    let vivant = true;
    let timer: ReturnType<typeof setTimeout>;

    async function allumer() {
      try {
        // Hors contexte sécurisé (http:// sur une adresse du réseau local),
        // `navigator.mediaDevices` n'existe tout simplement pas.
        if (!("mediaDevices" in navigator)) throw new Error("Contexte non sécurisé");
        const flux = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (!vivant) {
          flux.getTracks().forEach((piste) => piste.stop());
          return;
        }
        fluxRef.current = flux;
        if (videoRef.current) {
          videoRef.current.srcObject = flux;
          await videoRef.current.play();
        }
        setCamera("ACTIVE");
        boucle();
      } catch (erreur) {
        // Caméra refusée ou absente : la recherche manuelle reste utilisable,
        // et c'est elle qui sauve un poste dont l'appareil n'a pas d'objectif.
        setCause(identifierCause(erreur));
        setCamera("REFUSEE");
      }
    }

    function boucle() {
      if (!vivant) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const contexte = canvas.getContext("2d", { willReadFrequently: true });
        if (contexte) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          contexte.drawImage(video, 0, 0, canvas.width, canvas.height);
          const image = contexte.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(image.data, image.width, image.height, {
            inversionAttempts: "dontInvert",
          });
          if (code?.data) {
            void scannerDepuisQr(code.data);
          }
        }
      }
      timer = setTimeout(boucle, PERIODE_DECODAGE_MS);
    }

    void allumer();

    return () => {
      vivant = false;
      clearTimeout(timer);
      fluxRef.current?.getTracks().forEach((piste) => piste.stop());
      fluxRef.current = null;
    };
  }, [panneau, resultat, scannerDepuisQr, essaiCamera]);

  // --- Fermeture automatique du verdict ------------------------------------
  useEffect(() => {
    if (!resultat) return;
    const delai = DUREE_VERDICT_MS[resultat.verdict.couleur];
    const timer = setTimeout(() => setResultat(null), delai);
    return () => clearTimeout(timer);
  }, [resultat]);

  // --- Recherche manuelle ---------------------------------------------------
  useEffect(() => {
    let vivant = true;
    const timer = setTimeout(async () => {
      const resultats = await rechercher(recherche);
      if (vivant) setTrouves(resultats);
    }, 150);
    return () => {
      vivant = false;
      clearTimeout(timer);
    };
  }, [recherche]);

  async function synchroniserMaintenant() {
    setMessage(null);
    const etat = await synchroniserManifeste();
    if (etat.etat === "ERREUR") setMessage(etat.message);
    if (etat.etat === "HORS_LIGNE") setEnLigne(false);
    const envoi = await envoyerFile();
    setEnLigne(!envoi.horsLigne);
    await rafraichirCompteurs();
  }

  const ageManifeste = meta
    ? Math.round((Date.now() - new Date(meta.synchroniseLe).getTime()) / 60000)
    : null;

  return (
    <div className="fixed inset-0 flex flex-col bg-[#0B1622] text-white">
      {/*
        Empilé plutôt qu'aligné : sur un téléphone de 390 px, le nom du poste, le
        compteur et le bouton de synchronisation tenus sur une seule ligne se
        chevauchaient. Un agent lit cet en-tête d'un coup d'œil entre deux
        badges — il doit rester lisible sur l'appareil réel, pas sur un portable
        de développeur.
      */}
      <header className="border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <label htmlFor="point" className="sr-only">
            Point de contrôle
          </label>
          <select
            id="point"
            value={checkpointId}
            onChange={(evenement) => setCheckpointId(evenement.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-white/20 bg-[#132436] px-3 py-2 text-sm"
          >
            {(meta?.checkpoints ?? []).length === 0 && <option value="">Aucun point actif</option>}
            {meta?.checkpoints.map((candidat) => (
              <option key={candidat.id} value={candidat.id}>
                {candidat.name} — {candidat.zoneCode}
              </option>
            ))}
          </select>
          <span
            data-testid="etat-reseau"
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
              enLigne ? "bg-[#0F7B3E]" : "bg-[#B45309]"
            }`}
          >
            {enLigne ? "En ligne" : "Hors ligne"}
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between gap-3 text-xs">
          {/*
            Le nombre de badges d'abord : c'est ce qu'un agent vérifie d'un coup
            d'œil avant d'ouvrir sa file. Le nom du compte ferme la ligne, et
            c'est lui que la troncature mange en premier sur un écran étroit.
          */}
          <span data-testid="manifeste" className="min-w-0 truncate text-white/50">
            {meta?.entrees ?? 0} badges
            {ageManifeste !== null && ` · màj il y a ${ageManifeste} min`} · {nomAgent}
          </span>
          <div className="flex shrink-0 items-center gap-3">
            <span data-testid="en-file" className="text-white/70">
              {enFile} en attente
            </span>
            <button
              type="button"
              onClick={() => void synchroniserMaintenant()}
              className="rounded-lg border border-white/25 px-3 py-1.5 font-semibold"
            >
              Synchroniser
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 border-b border-white/10 text-sm">
        {(["CAMERA", "RECHERCHE"] as const).map((onglet) => (
          <button
            key={onglet}
            type="button"
            onClick={() => setPanneau(onglet)}
            aria-pressed={panneau === onglet}
            className={`border-b-2 py-2.5 ${
              panneau === onglet
                ? "border-white font-semibold text-white"
                : "border-transparent text-white/50"
            }`}
          >
            {onglet === "CAMERA" ? "Caméra" : "Recherche manuelle"}
          </button>
        ))}
      </div>

      {/*
        Rouge, et au-dessus du message ordinaire : tant qu'il s'affiche,
        l'appareil ne sert à rien. `alert` plutôt que `status` — un lecteur
        d'écran doit l'annoncer sans attendre la fin de ce qu'il lisait.
      */}
      {sansPoint && (
        <p role="alert" data-testid="sans-point" className="bg-[#9B1C22] px-4 py-2 text-sm">
          {sansPoint}
        </p>
      )}

      {message && (
        <p role="status" className="bg-[#B45309] px-4 py-2 text-sm">
          {message}
        </p>
      )}

      <main className="relative flex-1 overflow-hidden">
        {panneau === "CAMERA" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            {camera !== "ACTIVE" && (
              <div className="absolute flex max-w-md flex-col items-center gap-3 px-6 text-center text-sm text-white/70">
                <p data-testid="etat-camera" data-cause={camera === "REFUSEE" ? cause : undefined}>
                  {camera === "REFUSEE"
                    ? `${MESSAGES_CAMERA[cause]} La recherche manuelle reste disponible.`
                    : "Activation de la caméra…"}
                </p>
                {camera === "REFUSEE" && (
                  <button
                    type="button"
                    onClick={() => {
                      if (cause === "POLITIQUE") {
                        window.location.reload();
                        return;
                      }
                      setCamera("ETEINTE");
                      setEssaiCamera((essai) => essai + 1);
                    }}
                    className="rounded-lg border border-white/25 px-3 py-1.5 font-semibold text-white"
                  >
                    {cause === "POLITIQUE" ? "Recharger" : "Réessayer"}
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="absolute inset-0 overflow-y-auto p-4">
            <label htmlFor="recherche" className="mb-1.5 block text-xs font-semibold text-white/70">
              Nom, organisation ou identifiant
            </label>
            <input
              id="recherche"
              value={recherche}
              onChange={(evenement) => setRecherche(evenement.target.value)}
              placeholder="Sow, ANSD, FID26-…"
              className="w-full rounded-lg border border-white/20 bg-[#132436] px-3 py-2.5 text-sm"
            />
            <ul className="mt-3 flex flex-col gap-2">
              {trouves.map((entree) => (
                <li key={entree.h}>
                  <button
                    type="button"
                    onClick={() => void scanner(entree.h, entree)}
                    className="w-full rounded-lg border border-white/15 bg-[#132436] px-3 py-2.5 text-left"
                  >
                    <span className="block text-sm font-semibold">{entree.nom}</span>
                    <span className="block text-xs text-white/60">
                      {entree.publicId} · {entree.categorie}
                      {entree.organisation ? ` · ${entree.organisation}` : ""}
                    </span>
                  </button>
                </li>
              ))}
              {recherche.trim().length >= 2 && trouves.length === 0 && (
                <li className="text-sm text-white/60">Aucun badge ne correspond.</li>
              )}
            </ul>
          </div>
        )}

        {resultat && (
          <button
            type="button"
            data-testid="verdict"
            data-couleur={resultat.verdict.couleur}
            onClick={() => setResultat(null)}
            className={`absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center ${
              COULEURS[resultat.verdict.couleur]
            }`}
          >
            {resultat.entree?.photo && (
              /* eslint-disable-next-line @next/next/no-img-element -- image privée servie par une route authentifiée, hors optimiseur */
              <img
                src={`/api/v1/scan/photo/${resultat.entree.publicId}`}
                alt=""
                className="h-28 w-28 rounded-full border-4 border-white/60 object-cover"
              />
            )}
            <span className="text-3xl font-bold">{resultat.verdict.motif}</span>
            {resultat.entree ? (
              <>
                <span className="text-2xl">{resultat.entree.nom}</span>
                <span className="text-lg opacity-90">
                  {resultat.entree.categorie}
                  {resultat.entree.organisation ? ` · ${resultat.entree.organisation}` : ""}
                </span>
                <span className="font-mono text-sm opacity-75">{resultat.entree.publicId}</span>
              </>
            ) : (
              <span className="text-lg opacity-90">Aucun badge ne correspond à ce code.</span>
            )}
            {resultat.verdict.alertes.length > 0 && (
              <span className="rounded-full bg-black/25 px-4 py-1.5 text-sm font-semibold">
                {resultat.verdict.alertes.join(" · ")}
              </span>
            )}
            <span className="mt-2 text-xs opacity-70">Toucher pour continuer</span>
          </button>
        )}
      </main>
    </div>
  );
}
