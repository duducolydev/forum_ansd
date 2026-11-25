"use client";

import { useMemo, useState } from "react";
import { Download, Search, X } from "lucide-react";
import type { FiltrePresence } from "../service";
import {
  COLONNES_NOMINATIVES,
  COLONNES_PAR_DEFAUT,
  TYPES_EXTRACTION,
  filtrerLignes,
  organisationsDistinctes,
  qualificatifPresence,
  type ColonneNominative,
  type FiltresListePresents,
  type TypeExtraction,
} from "../extraction";

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
 *
 * Le filtre par organisation et l'extraction (25 novembre 2026) suivent la même
 * règle, écrite une fois dans `extraction.ts` : l'écran et le fichier
 * téléchargé ne peuvent pas diverger.
 */
export function ListePresents({
  jour,
  lignes,
  presenceInitiale = "PRESENTS",
}: {
  /** Jour affiché (`AAAA-MM-JJ`), transmis à l'extraction. */
  jour: string;
  lignes: LignePresent[];
  presenceInitiale?: FiltrePresence;
}) {
  const [recherche, setRecherche] = useState("");
  const [presence, setPresence] = useState<FiltrePresence>(presenceInitiale);
  const [categorie, setCategorie] = useState("");
  const [pays, setPays] = useState("");
  const [organisation, setOrganisation] = useState("");

  const categories = useMemo(
    () => [...new Set(lignes.map((ligne) => ligne.categorie))].sort((a, b) => a.localeCompare(b)),
    [lignes],
  );
  const listePays = useMemo(
    () => [...new Set(lignes.map((ligne) => ligne.pays))].sort((a, b) => a.localeCompare(b)),
    [lignes],
  );

  const organisations = useMemo(() => organisationsDistinctes(lignes), [lignes]);

  const filtres = useMemo<FiltresListePresents>(
    () => ({
      presence,
      categorie: categorie || undefined,
      pays: pays || undefined,
      organisation: organisation || undefined,
      recherche: recherche.trim() || undefined,
    }),
    [presence, categorie, pays, organisation, recherche],
  );
  const filtrees = useMemo(() => filtrerLignes(lignes, filtres), [lignes, filtres]);

  const filtreActif =
    Boolean(recherche || categorie || pays || organisation) || presence !== presenceInitiale;

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
        <Choix
          id="filtre-organisation"
          label="Organisation"
          valeur={organisation}
          onChange={setOrganisation}
          options={organisations.map((o) => ({ valeur: o.cle, libelle: o.libelle }))}
          large
        />

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
              setOrganisation("");
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

      <PanneauExtraction jour={jour} filtres={filtres} />

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
  large = false,
}: {
  id: string;
  label: string;
  valeur: string;
  onChange: (valeur: string) => void;
  options: (string | { valeur: string; libelle: string })[];
  /** Organisations : des libellés longs, bornés pour ne pas pousser le reste. */
  large?: boolean;
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
        className={`border-border bg-surface text-text rounded-lg border px-3 py-2.5 text-sm ${
          large ? "max-w-xs" : ""
        }`}
      >
        <option value="">Toutes</option>
        {options.map((option) => {
          const { valeur: cle, libelle } =
            typeof option === "string" ? { valeur: option, libelle: option } : option;
          return (
            <option key={cle} value={cle}>
              {libelle}
            </option>
          );
        })}
      </select>
    </div>
  );
}

const FORMATS = [
  { cle: "xlsx", libelle: "Excel" },
  { cle: "csv", libelle: "CSV" },
  { cle: "pdf", libelle: "PDF" },
] as const;

type Format = (typeof FORMATS)[number]["cle"];

/**
 * Extraction de ce que les filtres montrent (25 novembre 2026) : la liste,
 * aux colonnes choisies, ou les organisations, pays ou catégories qu'elle
 * réunit, avec présents et attendus. Le lien porte les filtres de l'écran.
 */
function PanneauExtraction({ jour, filtres }: { jour: string; filtres: FiltresListePresents }) {
  const [type, setType] = useState<TypeExtraction>("NOMINATIVE");
  const [colonnes, setColonnes] = useState<ColonneNominative[]>(COLONNES_PAR_DEFAUT);
  const [format, setFormat] = useState<Format>("xlsx");

  const parametres = new URLSearchParams({ jour, type, format, presence: filtres.presence });
  if (type === "NOMINATIVE") parametres.set("colonnes", colonnes.join(","));
  if (filtres.categorie) parametres.set("categorie", filtres.categorie);
  if (filtres.pays) parametres.set("pays", filtres.pays);
  if (filtres.organisation) parametres.set("organisation", filtres.organisation);
  if (filtres.recherche) parametres.set("q", filtres.recherche);
  const lien = `/api/v1/presences/extraction?${parametres.toString()}`;

  const qualificatif = qualificatifPresence(filtres.presence, type !== "PAYS");
  const libelleBouton =
    type === "NOMINATIVE"
      ? "Extraire la liste"
      : type === "ORGANISATIONS"
        ? `Extraire les organisations${qualificatif}`
        : type === "PAYS"
          ? `Extraire les pays${qualificatif}`
          : `Extraire les catégories${qualificatif}`;
  // Aucune colonne cochée : le serveur reprendrait les colonnes par défaut, ce
  // qui surprendrait ; le bouton est désactivé à la place.
  const bloque = type === "NOMINATIVE" && colonnes.length === 0;

  function basculer(cle: ColonneNominative, coche: boolean) {
    setColonnes((avant) =>
      COLONNES_NOMINATIVES.map((colonne) => colonne.cle).filter((c) =>
        c === cle ? coche : avant.includes(c),
      ),
    );
  }

  return (
    <div className="border-border bg-surface flex flex-col gap-3 rounded-xl border p-4">
      <div>
        <h3 className="text-heading text-sm font-semibold">Extraire</h3>
        <p className="text-text-3 text-xs">
          Suit les filtres ci-dessus. Un regroupement liste les organisations, pays ou catégories
          concernés, avec le nombre de présents et d&apos;attendus de chacun.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <span className="text-text-3 mb-1.5 block text-xs font-semibold">Contenu</span>
          <div className="flex flex-wrap gap-1">
            {TYPES_EXTRACTION.map((choix) => (
              <button
                key={choix.cle}
                type="button"
                onClick={() => setType(choix.cle)}
                aria-pressed={type === choix.cle}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                  type === choix.cle
                    ? "border-primary bg-primary text-primary-text"
                    : "border-border text-heading"
                }`}
              >
                {choix.libelle}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label
            htmlFor="extraction-format"
            className="text-text-3 mb-1.5 block text-xs font-semibold"
          >
            Format
          </label>
          <select
            id="extraction-format"
            value={format}
            onChange={(evenement) => setFormat(evenement.target.value as Format)}
            className="border-border bg-surface text-text rounded-lg border px-3 py-2.5 text-sm"
          >
            {FORMATS.map((choix) => (
              <option key={choix.cle} value={choix.cle}>
                {choix.libelle}
              </option>
            ))}
          </select>
        </div>

        {bloque ? (
          <span className="text-text-3 py-2.5 text-sm">Cochez au moins une colonne.</span>
        ) : (
          <a
            href={lien}
            className="bg-primary text-primary-text hover:bg-primary-hover inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold no-underline"
          >
            <Download aria-hidden size={15} />
            {libelleBouton}
          </a>
        )}
      </div>

      {type === "NOMINATIVE" && (
        <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
          <legend className="text-text-3 mb-1.5 text-xs font-semibold">Colonnes</legend>
          {COLONNES_NOMINATIVES.map((colonne) => (
            <label key={colonne.cle} className="text-text-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={colonnes.includes(colonne.cle)}
                onChange={(evenement) => basculer(colonne.cle, evenement.target.checked)}
                className="size-4"
              />
              {colonne.libelle}
            </label>
          ))}
        </fieldset>
      )}
      {format === "pdf" && (
        <p className="text-text-3 text-xs">
          Le PDF s&apos;arrête à 300 lignes ; au-delà, choisissez Excel.
        </p>
      )}
    </div>
  );
}
