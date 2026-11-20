"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { FiltrePresence } from "../service";

/** Une ligne telle qu'elle arrive du serveur : les dates y sont sérialisées. */
export interface LignePresent {
  publicId: string;
  nom: string;
  organisation: string | null;
  fonction: string | null;
  categorie: string;
  pays: string;
  /** Heure du premier passage, ISO ; `null` si la personne n'est pas venue. */
  premierPassage: string | null;
}

const HEURE = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

const PRESENCES: { cle: FiltrePresence; libelle: string }[] = [
  { cle: "PRESENTS", libelle: "Présents" },
  { cle: "ABSENTS", libelle: "Absents" },
  { cle: "TOUS", libelle: "Tous" },
];

/**
 * Liste nominative d'une journée, filtrable et cherchable.
 *
 * **Tout est filtré dans le navigateur**, et non par des allers-retours au
 * serveur : l'édition compte quelques centaines d'attendus, ils tiennent
 * largement dans une page, et la recherche doit répondre à la frappe. Un
 * filtre qui recharge la page à chaque lettre ne se sert pas au comptoir.
 *
 * La recherche porte sur le nom, l'organisation, la fonction et
 * l'identifiant — ce qu'on a sous les yeux quand on cherche quelqu'un. Elle
 * ignore les accents et la casse : « goree » doit trouver « Gorée », sans
 * quoi l'outil renvoie « aucun résultat » à une orthographe correcte.
 */
export function ListePresents({
  lignes,
  presenceInitiale = "PRESENTS",
}: {
  lignes: LignePresent[];
  presenceInitiale?: FiltrePresence;
}) {
  const [recherche, setRecherche] = useState("");
  const [presence, setPresence] = useState<FiltrePresence>(presenceInitiale);
  const [categorie, setCategorie] = useState("");
  const [pays, setPays] = useState("");

  const categories = useMemo(
    () => [...new Set(lignes.map((ligne) => ligne.categorie))].sort((a, b) => a.localeCompare(b)),
    [lignes],
  );
  const listePays = useMemo(
    () => [...new Set(lignes.map((ligne) => ligne.pays))].sort((a, b) => a.localeCompare(b)),
    [lignes],
  );

  const filtrees = useMemo(() => {
    const terme = sansAccents(recherche.trim());
    return lignes.filter((ligne) => {
      if (presence === "PRESENTS" && ligne.premierPassage === null) return false;
      if (presence === "ABSENTS" && ligne.premierPassage !== null) return false;
      if (categorie && ligne.categorie !== categorie) return false;
      if (pays && ligne.pays !== pays) return false;
      if (!terme) return true;
      const foin = sansAccents(
        `${ligne.nom} ${ligne.organisation ?? ""} ${ligne.fonction ?? ""} ${ligne.publicId}`,
      );
      return foin.includes(terme);
    });
  }, [lignes, recherche, presence, categorie, pays]);

  const filtreActif = Boolean(recherche || categorie || pays) || presence !== presenceInitiale;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[240px] flex-1">
          <label
            htmlFor="recherche-presents"
            className="text-text-3 mb-1.5 block text-xs font-semibold"
          >
            Rechercher
          </label>
          <Search
            aria-hidden
            size={16}
            className="text-text-3 pointer-events-none absolute bottom-3 left-3"
          />
          <input
            id="recherche-presents"
            type="search"
            value={recherche}
            onChange={(evenement) => setRecherche(evenement.target.value)}
            placeholder="Nom, organisation, fonction, identifiant…"
            className="border-border bg-surface text-text w-full rounded-lg border py-2.5 pr-3 pl-9 text-sm"
          />
        </div>

        <Choix
          id="filtre-categorie"
          label="Catégorie"
          valeur={categorie}
          onChange={setCategorie}
          options={categories}
        />
        <Choix id="filtre-pays" label="Pays" valeur={pays} onChange={setPays} options={listePays} />

        <div>
          <span className="text-text-3 mb-1.5 block text-xs font-semibold">Présence</span>
          <div className="flex gap-1">
            {PRESENCES.map((choix) => (
              <button
                key={choix.cle}
                type="button"
                onClick={() => setPresence(choix.cle)}
                aria-pressed={presence === choix.cle}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                  presence === choix.cle
                    ? "border-primary bg-primary text-primary-text"
                    : "border-border text-heading"
                }`}
              >
                {choix.libelle}
              </button>
            ))}
          </div>
        </div>

        {filtreActif && (
          <button
            type="button"
            onClick={() => {
              setRecherche("");
              setPresence(presenceInitiale);
              setCategorie("");
              setPays("");
            }}
            className="text-text-2 hover:text-heading inline-flex items-center gap-1.5 py-2.5 text-sm"
          >
            <X aria-hidden size={15} />
            Réinitialiser
          </button>
        )}
      </div>

      {/* Le compte est annoncé : sans lui, un filtre trop sévère se confond
          avec une base vide. */}
      <p className="text-text-3 text-sm" aria-live="polite">
        {filtrees.length} personne{filtrees.length > 1 ? "s" : ""} sur {lignes.length} attendue
        {lignes.length > 1 ? "s" : ""}
      </p>

      {filtrees.length === 0 ? (
        <p className="border-border bg-surface text-text-3 rounded-xl border p-8 text-center text-sm">
          Aucune personne ne correspond à ces critères.
        </p>
      ) : (
        <div className="border-border bg-surface overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border text-text-3 border-b text-left text-xs">
                <th className="px-4 py-3 font-semibold">Nom</th>
                <th className="px-4 py-3 font-semibold">Organisation</th>
                <th className="px-4 py-3 font-semibold">Fonction</th>
                <th className="px-4 py-3 font-semibold">Catégorie</th>
                <th className="px-4 py-3 font-semibold">Pays</th>
                <th className="px-4 py-3 text-right font-semibold">Entrée</th>
              </tr>
            </thead>
            <tbody>
              {filtrees.map((ligne) => (
                <tr key={ligne.publicId} className="border-border border-b last:border-0">
                  <td className="text-heading px-4 py-2.5 font-medium">
                    {ligne.nom}
                    <span className="text-text-3 block text-xs">{ligne.publicId}</span>
                  </td>
                  <td className="text-text-2 px-4 py-2.5">{ligne.organisation ?? "—"}</td>
                  <td className="text-text-2 px-4 py-2.5">{ligne.fonction ?? "—"}</td>
                  <td className="text-text-2 px-4 py-2.5">{ligne.categorie}</td>
                  <td className="text-text-2 px-4 py-2.5">{ligne.pays}</td>
                  <td className="px-4 py-2.5 text-right">
                    {ligne.premierPassage ? (
                      <span className="text-accent-text font-semibold tabular-nums">
                        {HEURE.format(new Date(ligne.premierPassage))}
                      </span>
                    ) : (
                      <span className="text-text-3">absent</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Choix({
  id,
  label,
  valeur,
  onChange,
  options,
}: {
  id: string;
  label: string;
  valeur: string;
  onChange: (valeur: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label htmlFor={id} className="text-text-3 mb-1.5 block text-xs font-semibold">
        {label}
      </label>
      <select
        id={id}
        value={valeur}
        onChange={(evenement) => onChange(evenement.target.value)}
        className="border-border bg-surface text-text rounded-lg border px-3 py-2.5 text-sm"
      >
        <option value="">Toutes</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Minuscules sans accents, pour que « goree » trouve « Gorée ». */
function sansAccents(valeur: string): string {
  return valeur.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}
