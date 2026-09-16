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
  categories,
  zones,
}: {
  jour: string;
  categories: { id: string; labelFr: string }[];
  zones: { id: string; name: string }[];
}) {
  const [categoryId, setCategoryId] = useState("");
  const [zoneId, setZoneId] = useState("");

  function lien(forme: "EMARGEMENT" | "CONSTAT"): string {
    const parametres = new URLSearchParams({ jour, forme });
    if (categoryId) parametres.set("categoryId", categoryId);
    if (zoneId) parametres.set("zoneId", zoneId);
    return `/api/v1/presences/export?${parametres.toString()}`;
  }

  return (
    <div className="border-border bg-surface rounded-xl border p-5">
      <h3 className="text-heading mb-1 text-sm font-semibold">Exporter en PDF</h3>
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
          <label htmlFor="export-zone" className="text-text-3 text-xs font-semibold">
            Zone (passage constaté)
          </label>
          <select
            id="export-zone"
            value={zoneId}
            onChange={(evenement) => setZoneId(evenement.target.value)}
            className={`${champ} w-52`}
          >
            <option value="">Toutes zones</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
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
          Liste de présence
        </a>
      </div>
    </div>
  );
}
