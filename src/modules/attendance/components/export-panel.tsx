"use client";

import { useState } from "react";

const champ = "border-border bg-bg text-text rounded-lg border px-3 py-2 text-sm";

/**
 * Export PDF des listes de présence.
 *
 * Le lien est construit côté client et ouvert dans un onglet : le rendu passe
 * par Puppeteer et prend quelques secondes sur plusieurs centaines de lignes.
 * Le laisser dans le fil de la page bloquerait l'écran sans rien indiquer,
 * alors qu'un téléchargement s'annonce tout seul.
 *
 * Les deux formes ne servent pas au même moment : l'émargement s'imprime
 * **avant** pour être signé, le constat s'édite **après** pour dire ce qui
 * s'est passé, absents compris.
 */
export function ExportPanel({
  jour,
  jourLibelle,
  categories,
}: {
  /** Jour choisi en haut de page (`AAAA-MM-JJ`), transmis tel quel à l'export. */
  jour: string;
  jourLibelle: string;
  categories: { id: string; labelFr: string }[];
}) {
  const [categoryId, setCategoryId] = useState("");
  const [presence, setPresence] = useState<"TOUS" | "PRESENTS" | "ABSENTS">("TOUS");

  function lien(forme: "EMARGEMENT" | "CONSTAT"): string {
    const parametres = new URLSearchParams({ jour, forme });
    if (categoryId) parametres.set("categoryId", categoryId);
    /*
     * Le filtre par zone a été retiré de cet écran le 17 novembre 2026 : on
     * badge une fois par jour à l'entrée, et proposer les trois zones aurait
     * produit deux exports vides sur trois, sans dire pourquoi. Le paramètre
     * `zoneId` reste accepté par la route, pour le jour où des portes seraient
     * de nouveau tenues.
     */
    // L'émargement se signe avant la séance : le filtre ne concerne que le constat.
    if (forme === "CONSTAT" && presence !== "TOUS") parametres.set("presence", presence);
    return `/api/v1/presences/export?${parametres.toString()}`;
  }

  return (
    <div className="border-border bg-surface rounded-xl border p-5">
      <h3 className="text-heading mb-1 text-sm font-semibold">Exporter en PDF — {jourLibelle}</h3>
      <p className="text-text-3 mb-4 text-xs">
        La feuille d&apos;émargement se prépare avant la séance, avec une colonne signature. La
        liste de présence rend compte après coup, absents compris.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="export-categorie" className="text-text-3 text-xs font-semibold">
            Catégorie
          </label>
          <select
            id="export-categorie"
            value={categoryId}
            onChange={(evenement) => setCategoryId(evenement.target.value)}
            className={`${champ} w-56`}
          >
            <option value="">Toutes</option>
            {categories.map((categorie) => (
              <option key={categorie.id} value={categorie.id}>
                {categorie.labelFr}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="export-presence" className="text-text-3 text-xs font-semibold">
            Présence (liste de présence)
          </label>
          <select
            id="export-presence"
            value={presence}
            onChange={(evenement) =>
              setPresence(evenement.target.value as "TOUS" | "PRESENTS" | "ABSENTS")
            }
            className={`${champ} w-56`}
          >
            <option value="TOUS">Présents et absents</option>
            <option value="PRESENTS">Présents uniquement</option>
            <option value="ABSENTS">Absents uniquement</option>
          </select>
        </div>

        <a
          href={lien("EMARGEMENT")}
          target="_blank"
          rel="noopener"
          className="border-border text-heading rounded-lg border px-4 py-2 text-sm font-semibold"
        >
          Feuille d&apos;émargement
        </a>
        <a
          href={lien("CONSTAT")}
          target="_blank"
          rel="noopener"
          className="bg-primary text-primary-text hover:bg-primary-hover rounded-lg px-4 py-2 text-sm font-semibold"
        >
          {presence === "PRESENTS"
            ? "Liste des présents"
            : presence === "ABSENTS"
              ? "Liste des absents"
              : "Liste de présence"}
        </a>
      </div>
    </div>
  );
}
