"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * Recherche dans la liste des intervenants (29 octobre 2026), sur le modèle de
 * celle des participants : le texte part à la validation (Entrée), les listes
 * déroulantes dès qu'on choisit. Tout vit dans l'adresse, qu'on peut garder ou
 * transmettre, et chaque changement ramène à la première page.
 */
export function IntervenantsToolbar({ sessions }: { sessions: { id: string; titleFr: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [, startTransition] = useTransition();
  const filtre = ["q", "sessionId", "publication"].some((cle) => searchParams.get(cle));

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          updateParam("q", q);
        }}
        className="min-w-[220px] flex-1"
      >
        <input
          type="search"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          aria-label="Rechercher un intervenant"
          placeholder="Nom, e-mail, organisation, fonction, pays, panel…"
          className="border-border bg-surface text-text w-full rounded-lg border px-3 py-2 text-sm"
        />
      </form>
      <select
        aria-label="Session"
        onChange={(event) => updateParam("sessionId", event.target.value)}
        defaultValue={searchParams.get("sessionId") ?? ""}
        className="border-border bg-surface text-text max-w-[320px] rounded-lg border px-3 py-2 text-sm"
      >
        <option value="">Toutes les sessions</option>
        {sessions.map((session) => (
          <option key={session.id} value={session.id}>
            {session.titleFr}
          </option>
        ))}
      </select>
      <select
        aria-label="Publication"
        onChange={(event) => updateParam("publication", event.target.value)}
        defaultValue={searchParams.get("publication") ?? ""}
        className="border-border bg-surface text-text rounded-lg border px-3 py-2 text-sm"
      >
        <option value="">Publiées et brouillons</option>
        <option value="publies">Publiées</option>
        <option value="brouillons">Brouillons</option>
      </select>
      {filtre && (
        <Link href={pathname} className="text-link px-2 text-sm font-semibold">
          Effacer les filtres
        </Link>
      )}
    </div>
  );
}
