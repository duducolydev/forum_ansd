"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

export interface OptionRecherche {
  value: string;
  label: string;
  /** Deuxième ligne, plus discrète : fonction, adresse, ville… */
  detail?: string;
}

interface Props {
  name: string;
  id?: string;
  defaultValue?: string;
  options: OptionRecherche[];
  /** Libellé de l'option vide. Absent, le champ devient obligatoire. */
  labelVide?: string;
  placeholderRecherche?: string;
  className?: string;
}

const CHAMP = "border-border bg-surface text-text w-full rounded-lg border px-3 py-2.5";

/**
 * Select enrichi d'une recherche, sur le principe de Select2 (§29).
 *
 * Le `<select>` natif **reste dans le formulaire** et garde la valeur : c'est
 * lui qui est soumis, et c'est lui qu'on voit tant que le JavaScript n'a pas
 * pris la main. La surcouche ne s'affiche qu'après montage, et masque alors
 * l'original comme le fait Select2 — un seul contrôle visible à la fois, jamais
 * deux champs pour une même valeur.
 *
 * Écrit ici plutôt qu'emprunté : Select2 suppose jQuery, que ce dépôt n'utilise
 * nulle part, et manipule directement le DOM du `<select>` — ce que React
 * défait au rendu suivant. Le comportement tient en une centaine de lignes, la
 * dépendance aurait coûté deux bibliothèques et un conflit permanent.
 */
export function SelectRecherche({
  name,
  id,
  defaultValue = "",
  options,
  labelVide,
  placeholderRecherche = "Rechercher…",
  className = "",
}: Props) {
  const idGenere = useId();
  const idChamp = id ?? idGenere;
  const idListe = `${idChamp}-liste`;

  const [enrichi, setEnrichi] = useState(false);
  const [ouvert, setOuvert] = useState(false);
  const [valeur, setValeur] = useState(defaultValue);
  const [filtre, setFiltre] = useState("");
  const [survole, setSurvole] = useState(0);
  const conteneur = useRef<HTMLDivElement>(null);

  /*
   * L'enrichissement n'a lieu qu'après montage : rendu côté serveur, la
   * surcouche apparaîtrait avant d'être pilotable, et un visiteur dont le
   * script n'a pas chargé se retrouverait devant un champ inerte.
   */
  useEffect(() => setEnrichi(true), []);

  // Fermeture au clic extérieur : une liste ouverte oubliée recouvre le reste
  // du formulaire et masque le bouton d'envoi.
  useEffect(() => {
    if (!ouvert) return;
    const auClic = (event: MouseEvent) => {
      if (!conteneur.current?.contains(event.target as Node)) setOuvert(false);
    };
    document.addEventListener("mousedown", auClic);
    return () => document.removeEventListener("mousedown", auClic);
  }, [ouvert]);

  const toutes = useMemo(
    () => (labelVide ? [{ value: "", label: labelVide }, ...options] : options),
    [labelVide, options],
  );

  const filtrees = useMemo(() => {
    const terme = filtre.trim().toLowerCase();
    if (!terme) return toutes;
    return toutes.filter((option) =>
      `${option.label} ${option.detail ?? ""}`.toLowerCase().includes(terme),
    );
  }, [filtre, toutes]);

  const choisie = toutes.find((option) => option.value === valeur);

  function choisir(nouvelle: string) {
    setValeur(nouvelle);
    setOuvert(false);
    setFiltre("");
  }

  function auClavier(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      setOuvert(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!ouvert) {
        setOuvert(true);
        return;
      }
      const pas = event.key === "ArrowDown" ? 1 : -1;
      setSurvole((n) => Math.max(0, Math.min(filtrees.length - 1, n + pas)));
      return;
    }
    if (event.key === "Enter" && ouvert) {
      event.preventDefault();
      const option = filtrees[survole];
      if (option) choisir(option.value);
    }
  }

  return (
    <div ref={conteneur} className="relative">
      {/*
        Le select natif : porteur du nom et de la valeur soumise. Sorti du flux
        et du parcours de tabulation une fois la surcouche en place, sans quoi
        le lecteur d'écran annoncerait deux fois le même champ.
      */}
      <select
        id={enrichi ? undefined : idChamp}
        name={name}
        value={valeur}
        onChange={(event) => setValeur(event.target.value)}
        className={enrichi ? "sr-only" : `${CHAMP} ${className}`}
        tabIndex={enrichi ? -1 : undefined}
        aria-hidden={enrichi || undefined}
      >
        {toutes.map((option) => (
          <option key={option.value || "vide"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {enrichi && (
        <>
          <button
            type="button"
            id={idChamp}
            role="combobox"
            aria-expanded={ouvert}
            aria-controls={idListe}
            aria-haspopup="listbox"
            onClick={() => setOuvert((v) => !v)}
            onKeyDown={auClavier}
            className={`${CHAMP} ${className} flex items-center justify-between gap-2 text-left`}
          >
            <span className={choisie?.value ? "text-text" : "text-text-3"}>
              {choisie?.label ?? labelVide ?? "—"}
            </span>
            <ChevronDown aria-hidden size={16} className="text-text-3 shrink-0" />
          </button>

          {ouvert && (
            <div className="border-border bg-surface absolute z-20 mt-1 w-full rounded-lg border shadow-lg">
              <div className="border-border relative border-b">
                <Search
                  aria-hidden
                  size={15}
                  className="text-text-3 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
                />
                <input
                  type="text"
                  autoFocus
                  value={filtre}
                  onChange={(event) => {
                    setFiltre(event.target.value);
                    setSurvole(0);
                  }}
                  onKeyDown={auClavier}
                  placeholder={placeholderRecherche}
                  aria-label={placeholderRecherche}
                  className="bg-surface text-text w-full rounded-t-lg py-2 pr-3 pl-9 text-sm outline-none"
                />
              </div>

              <ul id={idListe} role="listbox" className="max-h-60 overflow-y-auto py-1">
                {filtrees.map((option, index) => (
                  <li key={option.value || "vide"}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={option.value === valeur}
                      onMouseEnter={() => setSurvole(index)}
                      onClick={() => choisir(option.value)}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                        index === survole ? "bg-blue-soft" : ""
                      }`}
                    >
                      <Check
                        aria-hidden
                        size={14}
                        className={`shrink-0 ${
                          option.value === valeur ? "text-accent-text" : "opacity-0"
                        }`}
                      />
                      <span className="min-w-0">
                        <span className="text-text block truncate">{option.label}</span>
                        {option.detail && (
                          <span className="text-text-3 block truncate text-xs">
                            {option.detail}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
                {filtrees.length === 0 && (
                  <li className="text-text-3 px-3 py-3 text-sm">Aucun résultat.</li>
                )}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
