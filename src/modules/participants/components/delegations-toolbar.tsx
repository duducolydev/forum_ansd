"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { SelectRecherche } from "@/components/ui/select-recherche";
import { SITUATIONS_DELEGATION } from "../filtre-delegations";

const CHAMP = "border-border bg-surface text-text rounded-lg border px-3 py-2.5 text-sm";
const LIBELLE = "text-text-3 text-xs font-semibold";
const FILTRES = ["q", "country", "referentId", "situation"];

/**
 * Recherche et filtres de la liste des délégations, portés par l'URL comme
 * ceux des invitations : la vue filtrée se partage et se recharge telle quelle.
 */
export function DelegationsToolbar({
  countries,
  referents,
}: {
  countries: string[];
  referents: { id: string; name: string }[];
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
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  function reinitialiser() {
    setQ("");
    startTransition(() => router.push(pathname));
  }

  return (
    <div className="border-border bg-surface mb-4 flex flex-wrap items-end gap-2 rounded-xl border p-4">
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          updateParam("q", q.trim());
        }}
        className="flex min-w-[240px] flex-1 flex-col gap-1"
      >
        <label htmlFor="delegations-q" className={LIBELLE}>
          Recherche
        </label>
        <div className="relative">
          <Search
            aria-hidden
            size={15}
            className="text-text-3 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
          />
          <input
            id="delegations-q"
            type="search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Nom, pays, institution, chef, référent… puis Entrée"
            className={`${CHAMP} w-full pl-9`}
          />
        </div>
      </form>

      <div className="flex w-52 flex-col gap-1">
        <label htmlFor="delegations-country" className={LIBELLE}>
          Pays
        </label>
        {/* Remonté à chaque changement d'URL : sa valeur interne suit ainsi la réinitialisation. */}
        <SelectRecherche
          key={pays}
          id="delegations-country"
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
        <label htmlFor="delegations-referent" className={LIBELLE}>
          Référent
        </label>
        <select
          id="delegations-referent"
          value={searchParams.get("referentId") ?? ""}
          onChange={(event) => updateParam("referentId", event.target.value)}
          className={CHAMP}
        >
          <option value="">Tous</option>
          <option value="aucun">Sans référent</option>
          {referents.map((referent) => (
            <option key={referent.id} value={referent.id}>
              {referent.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="delegations-situation" className={LIBELLE}>
          Situation
        </label>
        <select
          id="delegations-situation"
          value={searchParams.get("situation") ?? ""}
          onChange={(event) => updateParam("situation", event.target.value)}
          className={CHAMP}
        >
          <option value="">Toutes</option>
          {Object.entries(SITUATIONS_DELEGATION).map(([value, label]) => (
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
