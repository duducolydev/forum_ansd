"use client";

import { useState } from "react";

import { LIGNES_VIERGES_DEFAUT, LIGNES_VIERGES_PAR_PAGE } from "../lignes-vierges";

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
 *
 * La feuille vierge (21 novembre 2026) est à part, et son encadré aussi : elle
 * ne sort pas de la base et ne suit donc pas le filtre de présence. Mise sur la
 * même ligne que les deux autres, elle aurait laissé croire qu'« absents
 * uniquement » s'y applique.
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
  const [lignesVides, setLignesVides] = useState(String(LIGNES_VIERGES_DEFAUT));

  function lien(forme: "EMARGEMENT" | "CONSTAT" | "VIERGE"): string {
    const parametres = new URLSearchParams({ jour, forme });
    if (categoryId) parametres.set("categoryId", categoryId);
    /*
     * La feuille vierge ne lit pas la base : la catégorie n'y sert qu'à titrer
     * le document, et le filtre de présence n'a rien à y filtrer.
     */
    if (forme === "VIERGE") {
      parametres.set("lignes", lignesVides);
      return `/api/v1/presences/export?${parametres.toString()}`;
    }
    /*
     * Le filtre par zone a été retiré de cet écran le 17 novembre 2026 : on
     * badge une fois par jour à l'entrée, et proposer les trois zones aurait
     * produit deux exports vides sur trois, sans dire pourquoi. Le paramètre
     * `zoneId` reste accepté par la route, pour le jour où des portes seraient
     * de nouveau tenues.
     */
    /*
     * Le filtre de présence vaut pour les deux formes (21 novembre 2026). Il
     * était réservé au constat, au motif qu'une feuille d'émargement se signe
     * avant la séance : vrai de la première séance d'une journée, faux des
     * suivantes, où l'on fait signer ceux qui sont arrivés et où l'on relance
     * ceux qui manquent.
     */
    if (presence !== "TOUS") parametres.set("presence", presence);
    return `/api/v1/presences/export?${parametres.toString()}`;
  }

  return (
    <div className="border-border bg-surface rounded-xl border p-5">
      <h3 className="text-heading mb-1 text-sm font-semibold">Exporter en PDF — {jourLibelle}</h3>
      <p className="text-text-3 mb-4 text-xs">
        La feuille d&apos;émargement se prépare avant la séance, avec une colonne signature. La
        liste de présence rend compte après coup, absents compris. Les deux suivent les filtres
        ci-dessous.
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
            Présence
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
          {presence === "PRESENTS"
            ? "Émargement des présents"
            : presence === "ABSENTS"
              ? "Émargement des absents"
              : "Feuille d’émargement"}
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

      <div className="border-border mt-5 border-t pt-5">
        <h4 className="text-heading mb-1 text-sm font-semibold">
          Feuille vierge — badges génériques
        </h4>
        <p className="text-text-3 mb-4 text-xs">
          Les colonnes de la feuille d&apos;émargement, lignes vides, plus la référence de la carte
          remise. Pour les arrivants munis d&apos;une carte générique, qui n&apos;ont pas de fiche
          en base : numéro de carte, nom, organisation et catégorie s&apos;écrivent au comptoir,
          puis la personne signe. La catégorie choisie ci-dessus titre le document ; le filtre de
          présence ne s&apos;y applique pas.
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="export-lignes" className="text-text-3 text-xs font-semibold">
              Pages à imprimer
            </label>
            <select
              id="export-lignes"
              value={lignesVides}
              onChange={(evenement) => setLignesVides(evenement.target.value)}
              className={`${champ} w-56`}
            >
              {/* En pages et non en lignes : c'est ainsi qu'on pense devant une
                  imprimante, et les comptes proposés remplissent des pages
                  entières plutôt que d'en laisser une portant une seule ligne. */}
              {[1, 2, 4, 8].map((pages) => (
                <option key={pages} value={String(pages * LIGNES_VIERGES_PAR_PAGE)}>
                  {pages} page{pages > 1 ? "s" : ""} — {pages * LIGNES_VIERGES_PAR_PAGE} lignes
                </option>
              ))}
            </select>
          </div>

          <a
            href={lien("VIERGE")}
            target="_blank"
            rel="noopener"
            className="border-border text-heading rounded-lg border px-4 py-2 text-sm font-semibold"
          >
            Feuille d&apos;émargement vierge
          </a>
        </div>
      </div>
    </div>
  );
}
