"use client";

import { selon, type Langue } from "@/lib/langue";
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Check, Tag } from "lucide-react";
import { SpeakersFlipGrid } from "@/components/home/SpeakersFlipGrid";
import type { DonneesSections } from "../donnees";

type Intervenant = NonNullable<DonneesSections["intervenants"]>[number];

/**
 * Intervenants de l'accueil : cartes retournables (brief « Constellation »
 * §4.3), filtrables par thème (demande du 28 septembre 2026).
 *
 * Sans filtre, la section montre les intervenants **mis en avant** en
 * BackOffice, dans leur ordre ; s'il n'y en a aucun, les premiers par ordre
 * alphabétique. Avec un filtre, elle cherche dans la liste entière.
 *
 * Le filtre agit sur place : l'accueil ne se recharge pas et ne remonte pas en
 * haut de page. Le nombre de résultats est annoncé aux lecteurs d'écran.
 */
export function IntervenantsFiltrables({
  intervenants,
  nombre,
  locale,
}: {
  intervenants: Intervenant[];
  nombre: number;
  locale: Langue;
}) {
  const [theme, setTheme] = useState<string | null>(null);

  const themes = useMemo(
    () =>
      [...new Set(intervenants.flatMap((intervenant) => intervenant.themes))].sort((a, b) =>
        a.localeCompare(b, "fr"),
      ),
    [intervenants],
  );

  const miseEnAvant = useMemo(() => {
    const choisis = intervenants
      .filter((intervenant) => intervenant.isFeatured)
      .sort((a, b) => a.featuredOrder - b.featuredOrder);
    return choisis.length > 0 ? choisis : intervenants;
  }, [intervenants]);

  const retenus = theme
    ? intervenants.filter((intervenant) => intervenant.themes.includes(theme))
    : miseEnAvant;
  const affiches = retenus.slice(0, nombre);

  return (
    <>
      {themes.length > 0 && (
        <div className="mb-8 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <div
            role="group"
            aria-label={selon(locale, {
              fr: "Filtrer par thème",
              en: "Filter by theme",
              pt: "Filtrar por tema",
            })}
            className="flex flex-wrap items-center gap-2"
          >
            <span className="flex w-20 shrink-0 items-center gap-1.5 text-xs font-bold tracking-wide text-[var(--muted)] uppercase">
              <Tag aria-hidden size={13} />
              {selon(locale, { fr: "Thèmes", en: "Themes", pt: "Temas" })}
            </span>
            <Pastille actif={theme === null} onClick={() => setTheme(null)}>
              {selon(locale, { fr: "Tous", en: "All", pt: "Todos" })}
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
        {selon(locale, {
          fr: `${retenus.length} intervenant${retenus.length > 1 ? "s" : ""}`,
          en: `${retenus.length} speaker${retenus.length > 1 ? "s" : ""}`,
          pt: `${retenus.length} orador${retenus.length > 1 ? "es" : ""}`,
        })}
      </p>

      {affiches.length === 0 ? (
        <p className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-8 text-center text-[var(--muted)]">
          {selon(locale, {
            fr: "Aucun intervenant sur ce thème pour l'instant.",
            en: "No speaker on this theme yet.",
            pt: "Ainda não há oradores neste tema.",
          })}
        </p>
      ) : (
        // La clé change avec le filtre : les cartes sont remontées et rejouent
        // leur entrée en cascade.
        <SpeakersFlipGrid key={theme ?? "tous"} intervenants={affiches} />
      )}

      {theme && retenus.length > 0 && (
        <p className="mt-8 text-center">
          <Link
            href={`/intervenants?theme=${encodeURIComponent(theme)}`}
            className="text-link inline-flex items-center gap-1.5 text-sm font-semibold"
          >
            {selon(locale, {
              fr: `Tous les intervenants sur « ${theme} »`,
              en: `All speakers on “${theme}”`,
              pt: `Todos os oradores sobre « ${theme} »`,
            })}
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
