"use client";
import { Trash2 } from "lucide-react";

import { useCallback, useEffect, useRef, useState } from "react";

/** Côté du rendu à l'écran, et côté de l'image produite. */
const APERCU = 224;
const SORTIE = 512;
const QUALITE = 0.85;

interface Props {
  /** Photo déjà enregistrée, affichée tant que l'utilisateur n'en choisit pas une autre. */
  photoActuelleUrl?: string | null;
  /** Appelé à chaque recadrage : `null` quand l'utilisateur retire sa sélection. */
  onChange: (fichier: File | null) => void;
  /** Proposé uniquement s'il y a une photo enregistrée à retirer. */
  onRemove?: () => void;
  label?: string;
  hint?: string;
}

/**
 * Champ photo avec recadrage carré (brief §5.3).
 *
 * Le recadrage se fait dans le navigateur : l'image envoyée au serveur est déjà
 * carrée, redimensionnée à 512 px et ré-encodée en JPEG. Trois bénéfices — le
 * badge reçoit un format prévisible, le transfert passe de plusieurs mégaoctets
 * à quelques dizaines de kilo-octets, et le ré-encodage **efface au passage les
 * métadonnées EXIF**, dont la géolocalisation que beaucoup de téléphones
 * inscrivent dans les photos.
 *
 * Le cadrage se règle à la souris **et au clavier** : un contrôle qui ne
 * s'utilise qu'en glissant serait inaccessible.
 */
export function PhotoField({ photoActuelleUrl, onChange, onRemove, label = "Photo", hint }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [decalage, setDecalage] = useState({ x: 0, y: 0 });
  const [erreur, setErreur] = useState<string | null>(null);
  const glisse = useRef<{ x: number; y: number } | null>(null);

  /** Échelle minimale pour que l'image couvre toujours le carré. */
  const echelleMin = useCallback(() => {
    const image = imageRef.current;
    if (!image) return 1;
    return APERCU / Math.min(image.naturalWidth, image.naturalHeight);
  }, []);

  const dessiner = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const echelle = echelleMin() * zoom;
    const largeur = image.naturalWidth * echelle;
    const hauteur = image.naturalHeight * echelle;

    // Bornes : le carré ne doit jamais laisser voir du vide.
    const x = Math.min(0, Math.max(APERCU - largeur, decalage.x));
    const y = Math.min(0, Math.max(APERCU - hauteur, decalage.y));

    ctx.clearRect(0, 0, APERCU, APERCU);
    ctx.drawImage(image, x, y, largeur, hauteur);
  }, [zoom, decalage, echelleMin]);

  useEffect(() => {
    dessiner();
  }, [dessiner]);

  useEffect(() => {
    return () => {
      if (source) URL.revokeObjectURL(source);
    };
  }, [source]);

  /** Produit le fichier final à partir du cadrage courant. */
  const exporter = useCallback(() => {
    const image = imageRef.current;
    if (!image) return;

    const rendu = document.createElement("canvas");
    rendu.width = SORTIE;
    rendu.height = SORTIE;
    const ctx = rendu.getContext("2d");
    if (!ctx) return;

    const facteur = SORTIE / APERCU;
    const echelle = echelleMin() * zoom;
    const largeur = image.naturalWidth * echelle;
    const hauteur = image.naturalHeight * echelle;
    const x = Math.min(0, Math.max(APERCU - largeur, decalage.x));
    const y = Math.min(0, Math.max(APERCU - hauteur, decalage.y));

    ctx.drawImage(image, x * facteur, y * facteur, largeur * facteur, hauteur * facteur);
    rendu.toBlob(
      (blob) => {
        if (blob) onChange(new File([blob], "photo.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      QUALITE,
    );
  }, [zoom, decalage, echelleMin, onChange]);

  // Le fichier est régénéré à chaque ajustement : l'utilisateur n'a pas à
  // « valider » son cadrage, ce que personne ne pense à faire.
  useEffect(() => {
    if (imageRef.current) exporter();
  }, [exporter]);

  function choisirFichier(fichier: File | undefined) {
    setErreur(null);
    if (!fichier) return;

    if (!fichier.type.startsWith("image/")) {
      setErreur("Choisissez une image (JPEG, PNG ou WebP).");
      return;
    }
    // 12 Mo : au-delà, le décodage fait peiner les téléphones d'entrée de gamme.
    if (fichier.size > 12 * 1024 * 1024) {
      setErreur("Image trop lourde (12 Mo maximum).");
      return;
    }

    const url = URL.createObjectURL(fichier);
    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      setZoom(1);
      setDecalage({ x: 0, y: 0 });
      // Centrage initial sur le plus grand côté.
      const echelle = APERCU / Math.min(image.naturalWidth, image.naturalHeight);
      setDecalage({
        x: (APERCU - image.naturalWidth * echelle) / 2,
        y: (APERCU - image.naturalHeight * echelle) / 2,
      });
    };
    image.onerror = () => setErreur("Image illisible. Essayez un autre fichier.");
    image.src = url;
    setSource(url);
  }

  function retirer() {
    imageRef.current = null;
    if (source) URL.revokeObjectURL(source);
    setSource(null);
    setErreur(null);
    onChange(null);
    onRemove?.();
  }

  function deplacer(dx: number, dy: number) {
    setDecalage((position) => ({ x: position.x + dx, y: position.y + dy }));
  }

  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-heading text-sm font-semibold">{label}</span>
      {hint && <span className="text-text-3 text-xs">{hint}</span>}

      <div className="flex flex-wrap items-start gap-4">
        {source ? (
          <div className="flex flex-col gap-2">
            <canvas
              ref={canvasRef}
              width={APERCU}
              height={APERCU}
              tabIndex={0}
              role="img"
              aria-label="Aperçu du cadrage. Utilisez les flèches du clavier pour déplacer l'image."
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                glisse.current = { x: event.clientX, y: event.clientY };
              }}
              onPointerMove={(event) => {
                if (!glisse.current) return;
                deplacer(event.clientX - glisse.current.x, event.clientY - glisse.current.y);
                glisse.current = { x: event.clientX, y: event.clientY };
              }}
              onPointerUp={() => (glisse.current = null)}
              onKeyDown={(event) => {
                const pas = event.shiftKey ? 20 : 5;
                const mouvements: Record<string, [number, number]> = {
                  ArrowLeft: [-pas, 0],
                  ArrowRight: [pas, 0],
                  ArrowUp: [0, -pas],
                  ArrowDown: [0, pas],
                };
                const mouvement = mouvements[event.key];
                if (!mouvement) return;
                event.preventDefault();
                deplacer(mouvement[0], mouvement[1]);
              }}
              className="border-border bg-bg-3 cursor-move touch-none rounded-full border"
            />
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-text-3">Zoom</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="accent-primary w-[224px]"
              />
            </label>
          </div>
        ) : photoActuelleUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoActuelleUrl}
            alt="Photo actuelle"
            className="border-border h-[224px] w-[224px] rounded-full border object-cover"
          />
        ) : (
          <div className="border-border bg-bg-3 text-text-3 grid h-[224px] w-[224px] place-items-center rounded-full border border-dashed text-center text-xs">
            Aucune photo
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label className="border-border text-heading w-fit cursor-pointer rounded-lg border px-4 py-2 text-sm font-semibold">
            {source || photoActuelleUrl ? "Changer la photo" : "Choisir une photo"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => choisirFichier(event.target.files?.[0])}
            />
          </label>

          {(source || photoActuelleUrl) && (
            <button
              type="button"
              onClick={retirer}
              className="text-text-3 hover:text-danger-text transition-tout inline-flex w-fit items-center gap-1.5 px-1 text-sm underline"
            >
              <Trash2 aria-hidden size={14} />
              Retirer la photo
            </button>
          )}

          <p className="text-text-3 max-w-[15rem] text-xs">
            Cadrez votre visage dans le cercle : c&apos;est ce cadrage qui figurera sur votre badge.
            Déplacez l&apos;image en la faisant glisser, ou avec les flèches du clavier.
          </p>
        </div>
      </div>

      {erreur && <p className="text-danger-text text-sm">{erreur}</p>}
    </div>
  );
}
