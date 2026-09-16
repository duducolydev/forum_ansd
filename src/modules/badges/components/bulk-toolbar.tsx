"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { genererEnLotAction, type BulkState } from "../bulk-actions";
import { Sparkles } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";

const champ = "border-border bg-bg text-text rounded-lg border px-3 py-2 text-sm";

/**
 * Filtres et actions de masse sur les badges (brief §5.4).
 *
 * Les filtres passent par l'URL plutôt que par un état local : le lien d'export
 * ZIP et la planche d'impression doivent porter **exactement** le périmètre
 * affiché, et une page rechargée ou partagée doit montrer la même chose.
 */
export function BulkToolbar({
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
  const [etat, setEtat] = useState<BulkState>({});
  const [enCours, startTransition] = useTransition();

  const categoryId = parametres.get("categoryId") ?? "";
  const delegationId = parametres.get("delegationId") ?? "";
  const etatBadge = parametres.get("etat") ?? "";

  function naviguer(cle: string, valeur: string) {
    const suite = new URLSearchParams(parametres.toString());
    if (valeur) suite.set(cle, valeur);
    else suite.delete(cle);
    router.push(suite.toString() ? `/admin/badges?${suite}` : "/admin/badges");
  }

  const filtre = {
    categoryId: categoryId || undefined,
    delegationId: delegationId || undefined,
    etat: (etatBadge || undefined) as "SANS" | "AVEC" | "REVOQUE" | undefined,
  };

  const requete = parametres.toString();
  const lienExport = `/api/v1/badges/export${requete ? `?${requete}` : ""}`;
  const lienPlanche = `/admin/badges/planche${requete ? `?${requete}` : ""}`;

  return (
    <div className="border-border bg-surface flex flex-col gap-4 rounded-xl border p-4">
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
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Bouton
          ton="principal"
          icone={Sparkles}
          type="button"
          disabled={enCours || aGenerer === 0}
          onClick={() => {
            setEtat({});
            startTransition(async () => {
              setEtat(await genererEnLotAction(filtre));
              router.refresh();
            });
          }}
        >
          {enCours ? "Mise en file…" : `Générer les ${aGenerer} badges manquants`}
        </Bouton>

        <a
          href={lienExport}
          className="border-border text-heading rounded-lg border px-4 py-2 text-sm font-semibold no-underline"
        >
          Export ZIP par délégation
        </a>
        <a
          href={lienPlanche}
          target="_blank"
          rel="noopener"
          className="border-border text-heading rounded-lg border px-4 py-2 text-sm font-semibold no-underline"
        >
          Planche d&apos;impression
        </a>
      </div>

      {etat.error && <p className="text-danger-text text-sm">{etat.error}</p>}
      {etat.message && !etat.error && (
        <p role="status" className="text-text-2 text-sm">
          {etat.message}
        </p>
      )}
    </div>
  );
}
