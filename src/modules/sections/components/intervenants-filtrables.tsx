"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Check, Tag } from "lucide-react";
import { Inclinaison } from "@/components/site/animations-accueil";
import type { DonneesSections } from "../donnees";

type Intervenant = NonNullable<DonneesSections["intervenants"]>[number];

/**
 * Grille des intervenants de l'accueil, filtrable par thème (demande du
 * commanditaire, 28 septembre 2026).
 *
 * Le panneau reprend celui de la page Intervenants — mêmes pastilles, même
 * coche sur le filtre actif —, mais filtre **sur place** : l'accueil ne se
 * recharge pas et ne remonte pas en haut de page à chaque clic. La liste
 * entière arrive du serveur ; le filtre cherche dedans, puis en affiche le
 * nombre réglé en BackOffice.
 *
 * À chaque changement, les cartes rejouent leur entrée, décalées l'une après
 * l'autre (`.apparait`, coupée sous `prefers-reduced-motion`), et le nombre de
 * résultats est annoncé aux lecteurs d'écran.
 */
export function IntervenantsFiltrables({
  intervenants,
  nombre,
  en,
}: {
  intervenants: Intervenant[];
  nombre: number;
  en: boolean;
}) {
  const [theme, setTheme] = useState<string | null>(null);

  const themes = useMemo(
    () =>
      [...new Set(intervenants.flatMap((intervenant) => intervenant.themes))].sort((a, b) =>
        a.localeCompare(b, "fr"),
      ),
    [intervenants],
  );

  const retenus = theme
    ? intervenants.filter((intervenant) => intervenant.themes.includes(theme))
    : intervenants;
  const affiches = retenus.slice(0, nombre);

  return (
    <>
      {themes.length > 0 && (
        <div className="border-border bg-surface mb-7 rounded-2xl border p-4">
          <div
            role="group"
            aria-label={en ? "Filter by theme" : "Filtrer par thème"}
            className="flex flex-wrap items-center gap-2"
          >
            <span className="text-text-2 flex w-20 shrink-0 items-center gap-1.5 text-xs font-bold tracking-wide uppercase">
              <Tag aria-hidden size={13} />
              {en ? "Themes" : "Thèmes"}
            </span>
            <Pastille actif={theme === null} onClick={() => setTheme(null)}>
              {en ? "All" : "Tous"}
            </Pastille>
            {themes.map((valeur) => (
              <Pastille
                key={valeur}
                actif={theme === valeur}
                // Rappuyer sur le filtre actif le retire, comme sur la page Intervenants.
                onClick={() => setTheme(theme === valeur ? null : valeur)}
              >
                {valeur}
              </Pastille>
            ))}
          </div>
        </div>
      )}

      <p aria-live="polite" className="sr-only">
        {en
          ? `${retenus.length} speaker${retenus.length > 1 ? "s" : ""}`
          : `${retenus.length} intervenant${retenus.length > 1 ? "s" : ""}`}
      </p>

      {affiches.length === 0 ? (
        <p className="border-border bg-surface text-text-3 rounded-xl border p-8 text-center">
          {en ? "No speaker on this theme yet." : "Aucun intervenant sur ce thème pour l'instant."}
        </p>
      ) : (
        // La clé change avec le filtre : la grille est remontée et les cartes
        // rejouent leur apparition.
        <div key={theme ?? "tous"} className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {affiches.map((intervenant, rang) => (
            <div
              key={intervenant.id}
              className="apparait h-full"
              style={{ animationDelay: `${rang * 70}ms` }}
            >
              <Inclinaison angleMax={6} className="h-full">
                <CarteIntervenant intervenant={intervenant} />
              </Inclinaison>
            </div>
          ))}
        </div>
      )}

      {theme && retenus.length > 0 && (
        <p className="mt-6 text-center">
          <Link
            href={`/intervenants?theme=${encodeURIComponent(theme)}`}
            className="text-link inline-flex items-center gap-1.5 text-sm font-semibold"
          >
            {en ? `All speakers on “${theme}”` : `Tous les intervenants sur « ${theme} »`}
            <ArrowRight aria-hidden size={14} />
          </Link>
        </p>
      )}
    </>
  );
}

function Pastille({
  actif,
  onClick,
  children,
}: {
  actif: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={`transition-tout inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm ${
        actif
          ? "border-primary bg-primary text-primary-text shadow-sm"
          : "border-border bg-surface text-text-2 hover:border-link hover:text-heading hover:-translate-y-0.5 hover:shadow-sm"
      }`}
    >
      {/* Une coche sur le filtre actif : l'état ne repose pas sur la seule couleur. */}
      {actif && <Check aria-hidden size={13} strokeWidth={3} />}
      {children}
    </button>
  );
}

/**
 * Carte d'un intervenant, animée au survol (`.carte-intervenant`, globals.css) :
 * la carte monte, la photo grossit dans son cadre rond — qui la rogne, elle
 * zoome sans déborder —, un halo monte derrière elle et un filet se déroule en
 * bas. L'inclinaison qui suit le pointeur vient d'`Inclinaison`, autour.
 */
function CarteIntervenant({ intervenant }: { intervenant: Intervenant }) {
  return (
    <div className="carte-intervenant group border-border bg-surface relative h-full overflow-hidden rounded-xl border p-5 text-center">
      <span
        aria-hidden
        className="halo from-blue-soft via-accent-soft/50 absolute inset-x-0 top-0 h-32 bg-gradient-to-b to-transparent"
      />
      {/* `relative` : sans lui, le halo positionné passerait par-dessus le texte. */}
      <div className="relative">
        <span className="ring-border group-hover:ring-ansd-vert-vif transition-tout mx-auto mb-3 block h-22 w-22 overflow-hidden rounded-full ring-2 ring-offset-2 ring-offset-[var(--surface)]">
          {intervenant.photoPath ? (
            /* eslint-disable-next-line @next/next/no-img-element -- servie par une route contrôlée, hors optimiseur */
            <img
              src={`/api/v1/speakers/${intervenant.id}/photo`}
              alt=""
              className="photo bg-bg-2 h-full w-full object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="photo from-ansd-bleu-vif to-ansd-vert-vif font-display grid h-full w-full place-items-center bg-gradient-to-br text-xl font-bold text-white"
            >
              {intervenant.firstName[0]}
              {intervenant.lastName[0]}
            </span>
          )}
        </span>
        <b className="font-display text-heading group-hover:text-link transition-tout block leading-snug">
          {intervenant.firstName} {intervenant.lastName}
        </b>
        {intervenant.jobTitle && (
          <span className="text-text-2 mt-1 block text-sm">{intervenant.jobTitle}</span>
        )}
        {intervenant.organization && (
          <span className="text-text-3 mt-0.5 block text-xs">{intervenant.organization}</span>
        )}
        {intervenant.themes.length > 0 && (
          <span className="mt-3 flex flex-wrap justify-center gap-1">
            {intervenant.themes.map((valeur) => (
              <span
                key={valeur}
                className="bg-bg-2 text-text-2 rounded-full px-2 py-0.5 text-[0.68rem]"
              >
                {valeur}
              </span>
            ))}
          </span>
        )}
      </div>
      <span
        aria-hidden
        className="filet-bas from-ansd-bleu-vif to-ansd-vert-vif absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r"
      />
    </div>
  );
}
