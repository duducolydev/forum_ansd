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
  /** Biographie et thèmes : montrés au verso sur la page Intervenants. */
  bio?: string | null;
  /**
   * Rôles tenus dans les sessions publiées (codes `PANELIST`, `MODERATOR`…),
   * affichés au verso (demande du 29 septembre 2026).
   */
  roles?: string[];
  themes?: string[];
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
  /**
   * Lien du verso. `null` sur la page Intervenants elle-même : la carte y est
   * la fiche, et son verso montre la biographie au lieu d'un lien.
   */
  lienProfil?: ((id: string) => string) | null;
  className?: string;
}) {
  return (
    <div className={`grille-retournables ${className}`}>
      {intervenants.map((intervenant, rang) => (
        <CarteRetournable
          key={intervenant.id}
          intervenant={intervenant}
          href={lienProfil ? lienProfil(intervenant.id) : null}
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
  href: string | null;
  delai: number;
}) {
  const t = useTranslations("constellation.speakers");
  const precis = useFinePointer();
  const ref = useRef<HTMLElement>(null);
  const refRecto = useRef<HTMLDivElement>(null);
  const [retournee, setRetournee] = useState(false);
  useReveal(ref);

  const nom = `${intervenant.firstName} ${intervenant.lastName}`;
  // Rôles : une information propre au verso, donc lue par les lecteurs d'écran.
  const roles = (intervenant.roles ?? []).map((role) => t(`roles.${role}`));
  const blocRoles =
    roles.length > 0 ? (
      <ul className="verso__roles police-grotesk" aria-label={`${nom} — ${t("rolesLabel")}`}>
        {roles.map((role) => (
          <li key={role}>{role}</li>
        ))}
      </ul>
    ) : null;

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
      // Ancre de la fiche : `/intervenants#intervenant-…` retourne la carte visée.
      id={`intervenant-${intervenant.id}`}
      // Sans lien au verso, c'est la carte elle-même qui prend le focus clavier.
      tabIndex={href ? undefined : 0}
      aria-label={href ? undefined : nom}
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
          {href ? (
            <>
              <div>
                <div aria-hidden>
                  <div className="verso__avatar">{initiales(intervenant)}</div>
                  {intervenant.organization && (
                    <div className="verso__organisation police-grotesk">
                      {intervenant.organization}
                    </div>
                  )}
                  <div className="verso__nom">{nom}</div>
                  {intervenant.jobTitle && (
                    <p className="verso__fonction">{intervenant.jobTitle}</p>
                  )}
                </div>
                {blocRoles}
              </div>
              <Link href={href} className="verso__lien" aria-label={`${t("profile")} — ${nom}`}>
                {t("profile")}
                <ArrowRight aria-hidden size={16} />
              </Link>
            </>
          ) : (
            // Fiche complète : la biographie est un contenu propre, lu par
            // les lecteurs d'écran ; le reste répète le recto.
            <div className="flex h-full flex-col">
              <div aria-hidden className="verso__nom text-[1.15rem]">
                {nom}
              </div>
              {blocRoles}
              {intervenant.bio ? (
                <p className="verso__bio">{intervenant.bio}</p>
              ) : (
                intervenant.jobTitle && <p className="verso__fonction">{intervenant.jobTitle}</p>
              )}
              {intervenant.themes && intervenant.themes.length > 0 && (
                <ul className="verso__themes">
                  {intervenant.themes.map((theme) => (
                    <li key={theme}>{theme}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
