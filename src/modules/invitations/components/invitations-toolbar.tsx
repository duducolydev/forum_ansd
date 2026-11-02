"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { SelectRecherche } from "@/components/ui/select-recherche";
import { STATUS_LABELS } from "./status-badge";

const CHAMP = "border-border bg-surface text-text rounded-lg border px-3 py-2.5 text-sm";
const LIBELLE = "text-text-3 text-xs font-semibold";
const FILTRES = ["q", "categoryId", "country", "status"];

/**
 * Filtres de la liste des invitations, portés par l'URL : la page se partage
 * et se recharge telle quelle, et la pagination les conserve.
 *
 * La catégorie et le pays servent aussi de cible aux envois groupés (voir
 * `FormulaireEnvois`) ; la recherche et le statut ne concernent que la liste.
 */
export function InvitationsToolbar({
  categories,
  countries,
}: {
  categories: { id: string; labelFr: string }[];
  countries: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [, startTransition] = useTransition();

  const pays = searchParams.get("country") ?? "";
  const filtreActif = FILTRES.some((cle) => searchParams.get(cle));

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  function reinitialiser() {
    const params = new URLSearchParams(searchParams.toString());
    for (const cle of [...FILTRES, "page"]) params.delete(cle);
    setQ("");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          updateParam("q", q.trim());
        }}
        className="flex min-w-[240px] flex-1 flex-col gap-1"
      >
        <label htmlFor="invitations-q" className={LIBELLE}>
          Recherche
        </label>
        <div className="relative">
          <Search
            aria-hidden
            size={15}
            className="text-text-3 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
          />
          <input
            id="invitations-q"
            type="search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Nom, e-mail, structure, pays… puis Entrée"
            className={`${CHAMP} w-full pl-9`}
          />
        </div>
      </form>

      <div className="flex flex-col gap-1">
        <label htmlFor="invitations-category" className={LIBELLE}>
          Catégorie
        </label>
        <select
          id="invitations-category"
          value={searchParams.get("categoryId") ?? ""}
          onChange={(event) => updateParam("categoryId", event.target.value)}
          className={CHAMP}
        >
          <option value="">Toutes</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.labelFr}
            </option>
          ))}
        </select>
      </div>

      <div className="flex w-52 flex-col gap-1">
        <label htmlFor="invitations-country" className={LIBELLE}>
          Pays
        </label>
        {/* Remonté à chaque changement d'URL : sa valeur interne suit ainsi la réinitialisation. */}
        <SelectRecherche
          key={pays}
          id="invitations-country"
          name="country"
          defaultValue={pays}
          options={countries.map((country) => ({ value: country, label: country }))}
          labelVide="Tous"
          placeholderRecherche="Rechercher un pays…"
          className="text-sm"
          onChange={(value) => updateParam("country", value)}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="invitations-status" className={LIBELLE}>
          Statut
        </label>
        <select
          id="invitations-status"
          value={searchParams.get("status") ?? ""}
          onChange={(event) => updateParam("status", event.target.value)}
          className={CHAMP}
        >
          <option value="">Tous</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {filtreActif && (
        <button
          type="button"
          onClick={reinitialiser}
          className="text-text-3 hover:text-text flex items-center gap-1 px-2 py-2.5 text-sm"
        >
          <X aria-hidden size={15} />
          Réinitialiser
        </button>
      )}
    </div>
  );
}
