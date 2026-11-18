"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { tailleLisible } from "@/lib/redimensionner-image";

/**
 * Téléchargement d'une archive de badges, avec son avancement.
 *
 * ## Deux temps, et un seul se chiffre
 *
 * Un simple `<a href>` laissait l'écran immobile : rien ne bougeait entre le
 * clic et l'arrivée du fichier, et trois cents badges ne se rassemblent pas
 * instantanément. Rien ne disait non plus si le clic avait porté, d'où les
 * seconds clics et les exports lancés en double.
 *
 * L'export se déroule en deux phases qu'il serait malhonnête de confondre :
 *
 * 1. **La préparation.** Le serveur lit les PDF et assemble l'archive avant
 *    d'envoyer le premier octet (`creerZip` rend un tampon complet). C'est la
 *    phase longue, et sa durée est **inconnaissable** depuis le navigateur :
 *    aucun pourcentage n'est possible. On montre donc un indicateur qui tourne,
 *    pas une barre à 0 % — une barre figée se lit comme une panne.
 * 2. **Le transfert.** Les octets arrivent, `Content-Length` est connu : la
 *    barre devient réelle et dit ce qu'elle mesure.
 *
 * Une barre unique sur les deux phases resterait à 0 % pendant l'essentiel de
 * l'attente avant de filer à 100 % : elle décrirait le contraire de ce qui se
 * passe.
 *
 * ## Ce que le lien perdait
 *
 * La route annonce depuis toujours `X-Badges-Inclus` et `X-Badges-Manquants`
 * — « une archive de 180 fichiers là où on en attendait 200 doit se voir ».
 * Un `<a href>` ne lit pas les en-têtes : l'information n'atteignait personne.
 * Passer par `fetch` la rend enfin visible, et c'est la seconde raison de ce
 * composant.
 */

type Etat =
  | { phase: "pret" }
  | { phase: "preparation" }
  | { phase: "transfert"; recus: number; total: number }
  | { phase: "fini"; inclus: number; manquants: number }
  | { phase: "erreur"; message: string };

/**
 * `attachment; filename="badges-2026-11-18.zip"` → le nom seul.
 *
 * Le navigateur le déduisait tout seul tant que le téléchargement passait par
 * un lien ; dès lors qu'il passe par `fetch`, c'est à nous de le lire — et un
 * en-tête mal analysé donne un fichier nommé « download » sans extension, que
 * Windows n'ouvre plus.
 */
export function nomPropose(entete: string | null, defaut: string): string {
  const trouve = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(entete ?? "");
  return trouve ? decodeURIComponent(trouve[1]) : defaut;
}

function entier(valeur: string | null): number {
  const nombre = Number(valeur);
  return Number.isFinite(nombre) && nombre >= 0 ? nombre : 0;
}

export function BoutonExportZip({
  href,
  libelle,
  titre,
}: {
  href: string;
  libelle: string;
  titre: string;
}) {
  const [etat, setEtat] = useState<Etat>({ phase: "pret" });

  /*
   * Une archive abandonnée en cours de route continuerait d'occuper le serveur
   * et la mémoire du navigateur. Quitter l'écran interrompt donc la requête.
   */
  const abandon = useRef<AbortController | null>(null);
  useEffect(() => () => abandon.current?.abort(), []);

  const enCours = etat.phase === "preparation" || etat.phase === "transfert";

  async function telecharger() {
    if (enCours) return;
    const controleur = new AbortController();
    abandon.current = controleur;
    setEtat({ phase: "preparation" });

    try {
      const reponse = await fetch(href, { signal: controleur.signal });
      if (!reponse.ok) {
        throw new Error(
          reponse.status === 401
            ? "Session expirée : rechargez la page et reconnectez-vous."
            : `Le serveur a répondu ${reponse.status}.`,
        );
      }

      const total = entier(reponse.headers.get("Content-Length"));
      const inclus = entier(reponse.headers.get("X-Badges-Inclus"));
      const manquants = entier(reponse.headers.get("X-Badges-Manquants"));
      const nom = nomPropose(reponse.headers.get("Content-Disposition"), "badges.zip");

      let archive: Blob;
      const lecteur = reponse.body?.getReader();
      if (lecteur) {
        const morceaux: BlobPart[] = [];
        let recus = 0;
        setEtat({ phase: "transfert", recus: 0, total });
        for (;;) {
          const { done, value } = await lecteur.read();
          if (done) break;
          morceaux.push(value as BlobPart);
          recus += value.byteLength;
          setEtat({ phase: "transfert", recus, total });
        }
        archive = new Blob(morceaux, { type: "application/zip" });
      } else {
        // Navigateur sans flux lisible : le fichier arrive quand même, sans
        // avancement. Mieux vaut un export sans barre qu'un export impossible.
        archive = await reponse.blob();
      }

      const lien = document.createElement("a");
      lien.href = URL.createObjectURL(archive);
      lien.download = nom;
      lien.click();
      URL.revokeObjectURL(lien.href);

      setEtat({ phase: "fini", inclus, manquants });
    } catch (erreur) {
      if (controleur.signal.aborted) return;
      setEtat({
        phase: "erreur",
        message: erreur instanceof Error ? erreur.message : "Export impossible.",
      });
    } finally {
      abandon.current = null;
    }
  }

  const pourcentage =
    etat.phase === "transfert" && etat.total > 0
      ? Math.min(100, Math.round((etat.recus / etat.total) * 100))
      : null;

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => void telecharger()}
        disabled={enCours}
        title={titre}
        aria-busy={enCours}
        className="border-border text-heading flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-60"
      >
        {enCours && <Loader2 aria-hidden size={15} className="animate-spin" />}
        {etat.phase === "preparation"
          ? "Préparation de l'archive…"
          : etat.phase === "transfert"
            ? pourcentage === null
              ? `Téléchargement — ${tailleLisible(etat.recus)}`
              : `Téléchargement ${pourcentage} %`
            : libelle}
      </button>

      {etat.phase === "transfert" && pourcentage !== null && (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pourcentage}
          aria-label={`Téléchargement de ${libelle}`}
          className="bg-bg-3 h-1.5 overflow-hidden rounded-full"
        >
          <div
            className="bg-primary h-full transition-[width]"
            style={{ width: `${pourcentage}%` }}
          />
        </div>
      )}

      {/*
       * Un seul `role="status"` pour les deux issues : une lectrice d'écran
       * annonce ainsi la préparation, puis le bilan, sans que deux régions se
       * disputent la parole.
       */}
      {etat.phase === "preparation" && (
        <p role="status" className="text-text-3 text-xs">
          Le serveur rassemble les PDF. Cela peut prendre une minute.
        </p>
      )}
      {etat.phase === "fini" && (
        <p role="status" className="text-accent-text text-xs">
          {etat.inclus} badge(s) dans l&apos;archive
          {etat.manquants > 0 ? ` · ${etat.manquants} PDF encore à générer` : ""}.
        </p>
      )}
      {etat.phase === "erreur" && (
        <p role="alert" className="text-danger-text text-xs">
          {etat.message}
        </p>
      )}
    </div>
  );
}
