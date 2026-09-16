"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

export function BarreFiltres({
  actions,
  entites,
  acteurs,
}: {
  actions: string[];
  entites: string[];
  acteurs: { id: string; nom: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [, startTransition] = useTransition();

  function majParametre(cle: string, valeur: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (valeur) params.set(cle, valeur);
    else params.delete(cle);
    // Un filtre changé remet à la première page : rester en page 7 d'un jeu de
    // résultats devenu court affiche une liste vide sans explication.
    params.delete("page");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  const champ = "border-border bg-surface text-text rounded-lg border px-3 py-2 text-sm";

  return (
    <div className="mb-3 flex flex-wrap gap-2">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          majParametre("q", q);
        }}
        className="min-w-[220px] flex-1"
      >
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Identifiant, action, auteur…"
          aria-label="Rechercher dans le journal"
          className={`w-full ${champ}`}
        />
      </form>
      <select
        aria-label="Action"
        onChange={(event) => majParametre("action", event.target.value)}
        defaultValue={searchParams.get("action") ?? ""}
        className={champ}
      >
        <option value="">Toutes actions</option>
        {actions.map((action) => (
          <option key={action} value={action}>
            {action}
          </option>
        ))}
      </select>
      <select
        aria-label="Objet"
        onChange={(event) => majParametre("entity", event.target.value)}
        defaultValue={searchParams.get("entity") ?? ""}
        className={champ}
      >
        <option value="">Tous objets</option>
        {entites.map((entite) => (
          <option key={entite} value={entite}>
            {entite}
          </option>
        ))}
      </select>
      <select
        aria-label="Auteur"
        onChange={(event) => majParametre("actorUserId", event.target.value)}
        defaultValue={searchParams.get("actorUserId") ?? ""}
        className={champ}
      >
        <option value="">Tous auteurs</option>
        {acteurs.map((acteur) => (
          <option key={acteur.id} value={acteur.id}>
            {acteur.nom}
          </option>
        ))}
      </select>
      <input
        type="date"
        aria-label="Depuis le"
        onChange={(event) => majParametre("du", event.target.value)}
        defaultValue={searchParams.get("du") ?? ""}
        className={champ}
      />
      <input
        type="date"
        aria-label="Jusqu'au"
        onChange={(event) => majParametre("au", event.target.value)}
        defaultValue={searchParams.get("au") ?? ""}
        className={champ}
      />
    </div>
  );
}
