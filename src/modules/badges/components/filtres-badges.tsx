"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { BoutonExportZip } from "./bouton-export-zip";

const champ = "border-border bg-bg text-text rounded-lg border px-3 py-2 text-sm";

/**
 * Filtres de l'écran Badges (brief §5.4).
 *
 * Ils passent par l'URL plutôt que par un état local : le lien d'export ZIP et
 * la planche d'impression doivent porter **exactement** le périmètre affiché,
 * et une page rechargée ou partagée doit montrer la même chose. Les actions de
 * masse s'appuient sur le même filtre (`actions-badges.tsx`).
 */
export function FiltresBadges({
  categories,
  delegations,
  total,
  aGenerer,
}: {
  categories: { id: string; labelFr: string }[];
  delegations: { id: string; name: string }[];
  total: number;
  aGenerer: number;
}) {
  const parametres = useSearchParams();
  const router = useRouter();

  const categoryId = parametres.get("categoryId") ?? "";
  const delegationId = parametres.get("delegationId") ?? "";
  const etatBadge = parametres.get("etat") ?? "";

  function naviguer(cle: string, valeur: string) {
    const suite = new URLSearchParams(parametres.toString());
    if (valeur) suite.set(cle, valeur);
    else suite.delete(cle);
    router.push(suite.toString() ? `/admin/badges?${suite}` : "/admin/badges");
  }

  const requete = parametres.toString();
  const lienPlanche = `/admin/badges/planche${requete ? `?${requete}` : ""}`;

  /*
   * Deux rangements pour le même périmètre.
   *
   * Les deux liens exportent exactement ce que le filtre désigne — les 305
   * participants affichés, si aucun filtre n'est posé. Ils ne diffèrent que
   * par la forme de l'archive : un dossier par délégation pour distribuer le
   * jour J, tous les PDF côte à côte pour imprimer ou transmettre d'un bloc.
   *
   * `rangement` est posé sur une copie des paramètres plutôt que concaténé à
   * la chaîne : un filtre vide donnait sinon « ?&rangement=plat ».
   */
  function lienExport(rangement: "delegation" | "plat"): string {
    const suite = new URLSearchParams(requete);
    if (rangement === "plat") suite.set("rangement", "plat");
    else suite.delete("rangement");
    return `/api/v1/badges/export${suite.toString() ? `?${suite}` : ""}`;
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="f-categorie" className="text-text-3 text-xs font-semibold">
          Catégorie
        </label>
        <select
          id="f-categorie"
          value={categoryId}
          onChange={(evenement) => naviguer("categoryId", evenement.target.value)}
          className={`${champ} w-52`}
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
        <label htmlFor="f-delegation" className="text-text-3 text-xs font-semibold">
          Délégation
        </label>
        <select
          id="f-delegation"
          value={delegationId}
          onChange={(evenement) => naviguer("delegationId", evenement.target.value)}
          className={`${champ} w-52`}
        >
          <option value="">Toutes</option>
          {delegations.map((delegation) => (
            <option key={delegation.id} value={delegation.id}>
              {delegation.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="f-etat" className="text-text-3 text-xs font-semibold">
          État du badge
        </label>
        <select
          id="f-etat"
          value={etatBadge}
          onChange={(evenement) => naviguer("etat", evenement.target.value)}
          className={`${champ} w-44`}
        >
          <option value="">Tous</option>
          <option value="SANS">À générer</option>
          <option value="AVEC">Généré</option>
          <option value="REVOQUE">Révoqué</option>
        </select>
      </div>

      <span className="text-text-3 ml-auto text-sm">
        {total} participant(s) · {aGenerer} sans badge
      </span>

      <div className="flex basis-full flex-wrap gap-3">
        <BoutonExportZip
          href={lienExport("delegation")}
          libelle="Export ZIP par délégation"
          titre={`Un dossier par délégation — ${total} badge(s) du filtre.`}
        />
        <BoutonExportZip
          href={lienExport("plat")}
          libelle="Export ZIP à plat"
          titre={`Tous les PDF côte à côte, sans dossiers — ${total} badge(s) du filtre.`}
        />
        <a
          href={lienPlanche}
          target="_blank"
          rel="noopener"
          className="border-border text-heading rounded-lg border px-4 py-2 text-sm font-semibold no-underline"
        >
          Planche d&apos;impression
        </a>
      </div>
    </div>
  );
}
