"use client";

import { selon, type Langue } from "@/lib/langue";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Building2, Check, Globe2, Mic, Plus, Search, Tag, X } from "lucide-react";
import { SpeakersFlipGrid, type IntervenantCarte } from "./SpeakersFlipGrid";

export interface IntervenantAnnuaire extends IntervenantCarte {
  country: string | null;
  themes: string[];
  /** Titres des sessions publiées où il intervient. */
  panels: string[];
}

interface Filtres {
  /** Recherche libre (30 septembre 2026). */
  q: string | null;
  theme: string | null;
  pays: string | null;
  organisation: string | null;
  panel: string | null;
}

const PAR_PAGE = 12;

/** « Rencontre à Dakar » → « rencontre a dakar » : accents et casse ignorés. */
function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Texte dans lequel la recherche s'applique : tout ce que montre la carte. */
function texteRecherchable(intervenant: IntervenantAnnuaire): string {
  return normaliser(
    [
      intervenant.firstName,
      intervenant.lastName,
      intervenant.jobTitle,
      intervenant.organization,
      intervenant.country,
      ...intervenant.themes,
      ...intervenant.panels,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

/**
 * Annuaire des intervenants (brief « Constellation » §6).
 *
 * Cartes retournables pour tous, verso = biographie. Quatre filtres —
 * thème, pays, organisation, panel — qui se combinent ; à chaque
 * changement, les cartes se réorganisent en fondu et translation (elles
 * rejouent leur entrée en cascade). Douze cartes d'abord, puis « Afficher
 * plus » : pas de page de mille cartes d'un coup.
 *
 * Les filtres sont reflétés dans l'adresse (`?theme=…&pays=…`) : un filtre
 * se partage, et les liens existants vers `/intervenants?theme=…` continuent
 * de fonctionner.
 */
export function AnnuaireIntervenants({
  intervenants,
  initial,
  locale,
}: {
  intervenants: IntervenantAnnuaire[];
  initial: Partial<Filtres>;
  locale: Langue;
}) {
  const [filtres, setFiltres] = useState<Filtres>({
    q: initial.q ?? null,
    theme: initial.theme ?? null,
    pays: initial.pays ?? null,
    organisation: initial.organisation ?? null,
    panel: initial.panel ?? null,
  });
  const [visibles, setVisibles] = useState(PAR_PAGE);

  const options = useMemo(() => {
    const trier = (liste: (string | null)[]) =>
      [...new Set(liste.filter((valeur): valeur is string => Boolean(valeur)))].sort((a, b) =>
        a.localeCompare(b, "fr"),
      );
    return {
      themes: trier(intervenants.flatMap((i) => i.themes)),
      pays: trier(intervenants.map((i) => i.country)),
      organisations: trier(intervenants.map((i) => i.organization)),
      panels: trier(intervenants.flatMap((i) => i.panels)),
    };
  }, [intervenants]);

  const index = useMemo(
    () => new Map(intervenants.map((i) => [i.id, texteRecherchable(i)])),
    [intervenants],
  );
  // Chaque mot saisi doit figurer quelque part : « diallo sénégal » trouve
  // Mariam Diallo, de Dakar, sans exiger l'ordre des mots.
  const mots = normaliser(filtres.q ?? "")
    .split(/\s+/)
    .filter(Boolean);

  const retenus = intervenants.filter(
    (i) =>
      mots.every((mot) => index.get(i.id)?.includes(mot)) &&
      (!filtres.theme || i.themes.includes(filtres.theme)) &&
      (!filtres.pays || i.country === filtres.pays) &&
      (!filtres.organisation || i.organization === filtres.organisation) &&
      (!filtres.panel || i.panels.includes(filtres.panel)),
  );

  /*
   * Lien « Voir le profil » de l'accueil (`#intervenant-…`) : la carte visée
   * peut être au-delà des douze premières. On ouvre la liste jusqu'à elle, puis
   * on la fait venir à l'écran — elle se présente retournée (`:target`).
   */
  useEffect(() => {
    const ancre = window.location.hash.replace(/^#intervenant-/, "");
    if (!ancre || ancre === window.location.hash) return;
    const rang = intervenants.findIndex((intervenant) => intervenant.id === ancre);
    if (rang < 0) return;
    setVisibles((valeur) => Math.max(valeur, Math.ceil((rang + 1) / PAR_PAGE) * PAR_PAGE));
    window.requestAnimationFrame(() =>
      document.getElementById(`intervenant-${ancre}`)?.scrollIntoView({ block: "center" }),
    );
  }, [intervenants]);

  // L'adresse suit les filtres, sans navigation ni retour en haut de page.
  useEffect(() => {
    const parametres = new URLSearchParams();
    if (filtres.q) parametres.set("q", filtres.q);
    if (filtres.theme) parametres.set("theme", filtres.theme);
    if (filtres.pays) parametres.set("pays", filtres.pays);
    if (filtres.organisation) parametres.set("organisation", filtres.organisation);
    if (filtres.panel) parametres.set("panel", filtres.panel);
    const suite = parametres.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${suite ? `?${suite}` : ""}${window.location.hash}`,
    );
  }, [filtres]);

  function changer(cle: keyof Filtres, valeur: string | null) {
    setFiltres((avant) => ({ ...avant, [cle]: valeur }));
    setVisibles(PAR_PAGE);
  }

  const cle = JSON.stringify(filtres);
  const actifs = Object.values(filtres).some(Boolean);

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <div role="search" className="relative">
          <label htmlFor="recherche-intervenant" className="sr-only">
            {selon(locale, {
              fr: "Rechercher un intervenant",
              en: "Search for a speaker",
              pt: "Pesquisar um orador",
            })}
          </label>
          <Search
            aria-hidden
            size={17}
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[var(--muted)]"
          />
          <input
            id="recherche-intervenant"
            type="search"
            value={filtres.q ?? ""}
            onChange={(evenement) => changer("q", evenement.target.value || null)}
            placeholder={selon(locale, {
              fr: "Rechercher : nom, organisation, pays, thème…",
              en: "Search: name, organisation, country, theme…",
              pt: "Pesquisar: nome, organização, país, tema…",
            })}
            autoComplete="off"
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] py-2.5 pr-10 pl-10 text-[var(--text)] placeholder:text-[var(--muted)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--gold)] [&::-webkit-search-cancel-button]:appearance-none"
          />
          {filtres.q && (
            <button
              type="button"
              onClick={() => changer("q", null)}
              aria-label={selon(locale, {
                fr: "Effacer la recherche",
                en: "Clear the search",
                pt: "Limpar a pesquisa",
              })}
              className="absolute top-1/2 right-2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-[var(--muted)] hover:text-[var(--title)]"
            >
              <X aria-hidden size={15} />
            </button>
          )}
        </div>

        {options.themes.length > 0 && (
          <div
            role="group"
            aria-label={selon(locale, { fr: "Thèmes", en: "Themes", pt: "Temas" })}
            className="flex flex-wrap items-center gap-2"
          >
            <span className="flex w-20 shrink-0 items-center gap-1.5 text-xs font-bold tracking-wide text-[var(--muted)] uppercase">
              <Tag aria-hidden size={13} />
              {selon(locale, { fr: "Thèmes", en: "Themes", pt: "Temas" })}
            </span>
            {options.themes.map((theme) => (
              <Pastille
                key={theme}
                actif={filtres.theme === theme}
                onClick={() => changer("theme", filtres.theme === theme ? null : theme)}
              >
                {theme}
              </Pastille>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Choix
            id="filtre-pays"
            libelle={selon(locale, { fr: "Pays", en: "Country", pt: "País" })}
            icone={<Globe2 aria-hidden size={13} />}
            valeur={filtres.pays}
            options={options.pays}
            tous={selon(locale, {
              fr: "Tous les pays",
              en: "All countries",
              pt: "Todos os países",
            })}
            onChange={(valeur) => changer("pays", valeur)}
          />
          <Choix
            id="filtre-organisation"
            libelle={selon(locale, { fr: "Organisation", en: "Organisation", pt: "Organização" })}
            icone={<Building2 aria-hidden size={13} />}
            valeur={filtres.organisation}
            options={options.organisations}
            tous={selon(locale, {
              fr: "Toutes les organisations",
              en: "All organisations",
              pt: "Todas as organizações",
            })}
            onChange={(valeur) => changer("organisation", valeur)}
          />
          <Choix
            id="filtre-panel"
            libelle={selon(locale, { fr: "Panel", en: "Panel", pt: "Painel" })}
            icone={<Mic aria-hidden size={13} />}
            valeur={filtres.panel}
            options={options.panels}
            tous={selon(locale, {
              fr: "Toutes les sessions",
              en: "All sessions",
              pt: "Todas as sessões",
            })}
            onChange={(valeur) => changer("panel", valeur)}
          />
        </div>

        {actifs && (
          <button
            type="button"
            onClick={() => {
              setFiltres({ q: null, theme: null, pays: null, organisation: null, panel: null });
              setVisibles(PAR_PAGE);
            }}
            className="self-start text-sm font-semibold text-[var(--title)] underline underline-offset-4"
          >
            {selon(locale, {
              fr: "Effacer les filtres",
              en: "Clear filters",
              pt: "Limpar os filtros",
            })}
          </button>
        )}
      </div>

      <p aria-live="polite" className="mb-4 text-sm text-[var(--muted)]">
        {selon(locale, {
          fr: `${retenus.length} intervenant${retenus.length > 1 ? "s" : ""}`,
          en: `${retenus.length} speaker${retenus.length > 1 ? "s" : ""}`,
          pt: `${retenus.length} orador${retenus.length > 1 ? "es" : ""}`,
        })}
      </p>

      {retenus.length === 0 ? (
        <p className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-8 text-center text-[var(--muted)]">
          {selon(locale, {
            fr: "Aucun intervenant ne correspond à ces filtres pour l'instant.",
            en: "No speaker matches these filters yet.",
            pt: "Ainda nenhum orador corresponde a estes filtros.",
          })}
        </p>
      ) : (
        // Nouvelle clé à chaque filtre : les cartes se réorganisent en cascade.
        <SpeakersFlipGrid key={cle} intervenants={retenus.slice(0, visibles)} lienProfil={null} />
      )}

      {retenus.length > visibles && (
        <div className="mt-10 flex justify-center">
          <button
            type="button"
            data-magnetic
            onClick={() => setVisibles((valeur) => valeur + PAR_PAGE)}
            className="relative inline-flex items-center gap-2 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] px-5 py-3 font-semibold text-[var(--title)]"
          >
            <Plus aria-hidden size={17} />
            {selon(locale, {
              fr: `Afficher plus (${retenus.length - visibles})`,
              en: `Show more (${retenus.length - visibles})`,
              pt: `Mostrar mais (${retenus.length - visibles})`,
            })}
          </button>
        </div>
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
      {/* La coche : l'état ne repose pas sur la seule couleur. */}
      {actif && <Check aria-hidden size={13} strokeWidth={3} />}
      {children}
    </button>
  );
}

function Choix({
  id,
  libelle,
  icone,
  valeur,
  options,
  tous,
  onChange,
}: {
  id: string;
  libelle: string;
  icone: ReactNode;
  valeur: string | null;
  options: string[];
  tous: string;
  onChange: (valeur: string | null) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-[var(--muted)] uppercase"
      >
        {icone}
        {libelle}
      </label>
      <select
        id={id}
        value={valeur ?? ""}
        onChange={(evenement) => onChange(evenement.target.value || null)}
        className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
      >
        <option value="">{tous}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
