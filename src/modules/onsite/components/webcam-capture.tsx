"use client";

import { useEffect, useRef, useState } from "react";

/** Côté de l'image produite, en pixels — même format que la photo d'inscription. */
const SORTIE = 512;

/**
 * Prise de photo au comptoir (brief §5.7, facultative).
 *
 * Le cadre est **carré et centré** sur le flux vidéo : le badge affiche un
 * rond, et laisser l'agent recadrer devant une file coûterait plus de temps que
 * la photo n'en fait gagner. Le ré-encodage en JPEG efface au passage les
 * métadonnées, comme pour la photo déposée en ligne.
 *
 * Facultative au sens strict : si la caméra manque ou est refusée, le composant
 * le dit et l'inscription continue sans photo.
 */
export function WebcamCapture({ onCapture }: { onCapture: (fichier: File | null) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fluxRef = useRef<MediaStream | null>(null);
  const [etat, setEtat] = useState<"ETEINTE" | "ACTIVE" | "REFUSEE">("ETEINTE");
  const [apercu, setApercu] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      fluxRef.current?.getTracks().forEach((piste) => piste.stop());
      if (apercu) URL.revokeObjectURL(apercu);
    };
  }, [apercu]);

  async function allumer() {
    try {
      const flux = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "user" } },
        audio: false,
      });
      fluxRef.current = flux;
      if (videoRef.current) {
        videoRef.current.srcObject = flux;
        await videoRef.current.play();
      }
      setEtat("ACTIVE");
    } catch {
      setEtat("REFUSEE");
    }
  }

  function capturer() {
    const video = videoRef.current;
    if (!video) return;

    const cote = Math.min(video.videoWidth, video.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = SORTIE;
    canvas.height = SORTIE;
    const contexte = canvas.getContext("2d");
    if (!contexte) return;

    contexte.drawImage(
      video,
      (video.videoWidth - cote) / 2,
      (video.videoHeight - cote) / 2,
      cote,
      cote,
      0,
      0,
      SORTIE,
      SORTIE,
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const fichier = new File([blob], "webcam.jpg", { type: "image/jpeg" });
        if (apercu) URL.revokeObjectURL(apercu);
        setApercu(URL.createObjectURL(blob));
        onCapture(fichier);

        fluxRef.current?.getTracks().forEach((piste) => piste.stop());
        fluxRef.current = null;
        setEtat("ETEINTE");
      },
      "image/jpeg",
      0.85,
    );
  }

  function reprendre() {
    if (apercu) URL.revokeObjectURL(apercu);
    setApercu(null);
    onCapture(null);
    void allumer();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {apercu ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local, jamais servi */}
          <img
            src={apercu}
            alt="Photo prise"
            className="border-border h-20 w-20 rounded-full border object-cover"
          />
          <button
            type="button"
            onClick={reprendre}
            className="border-border text-heading rounded-lg border px-3 py-2 text-sm font-semibold"
          >
            Reprendre
          </button>
        </>
      ) : (
        <>
          <video
            ref={videoRef}
            playsInline
            muted
            className={`border-border h-20 w-20 rounded-full border object-cover ${
              etat === "ACTIVE" ? "" : "hidden"
            }`}
          />
          {etat === "ACTIVE" ? (
            <button
              type="button"
              onClick={capturer}
              className="bg-primary text-primary-text rounded-lg px-4 py-2 text-sm font-semibold"
            >
              Prendre la photo
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void allumer()}
              className="border-border text-heading rounded-lg border px-3 py-2 text-sm font-semibold"
            >
              Photo par webcam
            </button>
          )}
          {etat === "REFUSEE" && (
            <span className="text-text-3 text-xs">
              Caméra indisponible — l&apos;inscription se poursuit sans photo.
            </span>
          )}
        </>
      )}
    </div>
  );
}
