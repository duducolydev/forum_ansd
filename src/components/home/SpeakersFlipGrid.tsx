"use client";

import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFinePointer, useReveal } from "@/components/motion/hooks";

export interface IntervenantCarte {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  organization: string | null;
  photoPath: string | null;
}

/**
 * Grille de cartes retournables (brief §4.3).
 *
 * Recto clair — avatar à anneau conique tricolore, photo réelle ou initiales,
 * nom, fonction, organisation, projecteur vert qui suit la souris. Verso
 * marine → vert — organisation, nom, fonction, lien vers la fiche.
 *
 * La carte se retourne :
 * - **au survol**, à la souris ;
 * - **au toucher**, sur écran tactile (le toucher bascule la carte) ;
 * - **au clavier** : le lien du verso reçoit le focus, et `:focus-within`
 *   retourne la carte pour le montrer.
 *
 * Le verso répète ce que dit le recto : il est masqué aux lecteurs d'écran,
 * sauf son lien, dont l'intitulé nomme l'intervenant.
 *
 * Entrée en cascade (translateY 60 px + rotateX 20°), décalée selon la
 * colonne et la ligne.
 */
export function SpeakersFlipGrid({
  intervenants,
  lienProfil = (id) => `/intervenants#intervenant-${id}`,
  className = "",
}: {
  intervenants: IntervenantCarte[];
  lienProfil?: (id: string) => string;
  className?: string;
}) {
  return (
    <div className={`grille-retournables ${className}`}>
      {intervenants.map((intervenant, rang) => (
        <CarteRetournable
          key={intervenant.id}
          intervenant={intervenant}
          href={lienProfil(intervenant.id)}
          delai={(rang % 4) * 0.1 + Math.floor(rang / 4) * 0.15}
        />
      ))}
    </div>
  );
}

function initiales(intervenant: IntervenantCarte): string {
  return `${intervenant.firstName[0] ?? ""}${intervenant.lastName[0] ?? ""}`.toUpperCase();
}

function CarteRetournable({
  intervenant,
  href,
  delai,
}: {
  intervenant: IntervenantCarte;
  href: string;
  delai: number;
}) {
  const t = useTranslations("constellation.speakers");
  const precis = useFinePointer();
  const ref = useRef<HTMLElement>(null);
  const refRecto = useRef<HTMLDivElement>(null);
  const [retournee, setRetournee] = useState(false);
  useReveal(ref);

  const nom = `${intervenant.firstName} ${intervenant.lastName}`;

  function projecteur(evenement: PointerEvent<HTMLElement>) {
    const recto = refRecto.current;
    if (!recto || evenement.pointerType !== "mouse") return;
    const cadre = evenement.currentTarget.getBoundingClientRect();
    recto.style.setProperty("--mx", `${evenement.clientX - cadre.left}px`);
    recto.style.setProperty("--my", `${evenement.clientY - cadre.top}px`);
  }

  return (
    <article
      ref={ref}
      className="retournable"
      data-retournee={retournee ? "" : undefined}
      style={{ "--d": `${delai}s` } as CSSProperties}
      onPointerMove={projecteur}
      // Au toucher, la carte bascule ; un toucher sur le lien du verso, lui,
      // suit le lien.
      onClick={(evenement) => {
        if (precis || (evenement.target as Element).closest("a")) return;
        setRetournee((valeur) => !valeur);
      }}
    >
      <div className="retournable__interieur">
        <div ref={refRecto} className="face face--recto">
          <div className="avatar-anneau">
            <span className="avatar-anneau__contenu">
              {intervenant.photoPath ? (
                <Image
                  src={`/api/v1/speakers/${intervenant.id}/photo`}
                  alt=""
                  fill
                  sizes="110px"
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <span aria-hidden>{initiales(intervenant)}</span>
              )}
            </span>
          </div>
          <h3 className="face__nom">{nom}</h3>
          {intervenant.jobTitle && <p className="face__fonction">{intervenant.jobTitle}</p>}
          {intervenant.organization && (
            <small className="face__organisation">{intervenant.organization}</small>
          )}
          <span aria-hidden className="face__indice police-grotesk">
            {precis ? t("hover") : t("touch")}
          </span>
        </div>

        <div className="face face--verso">
          <div aria-hidden>
            <div className="verso__avatar">{initiales(intervenant)}</div>
            {intervenant.organization && (
              <div className="verso__organisation police-grotesk">{intervenant.organization}</div>
            )}
            <div className="verso__nom">{nom}</div>
            {intervenant.jobTitle && <p className="verso__fonction">{intervenant.jobTitle}</p>}
          </div>
          <Link href={href} className="verso__lien" aria-label={`${t("profile")} — ${nom}`}>
            {t("profile")}
            <ArrowRight aria-hidden size={16} />
          </Link>
        </div>
      </div>
    </article>
  );
}
