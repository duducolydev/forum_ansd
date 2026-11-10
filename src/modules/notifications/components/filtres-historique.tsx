"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

const STATUTS = [
  { valeur: "SENT", libelle: "Envoyé" },
  { valeur: "FAILED", libelle: "Échec" },
  { valeur: "BOUNCED", libelle: "Rebond" },
  { valeur: "QUEUED", libelle: "En file" },
];

export function FiltresHistorique({ modeles }: { modeles: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [, startTransition] = useTransition();

  function majParametre(cle: string, valeur: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (valeur) params.set(cle, valeur);
    else params.delete(cle);
    // Un filtre changé remet à la première page.
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
          placeholder="Adresse e-mail, nom, identifiant…"
          aria-label="Rechercher un destinataire"
          className={`w-full ${champ}`}
        />
      </form>
      <select
        aria-label="État"
        onChange={(event) => majParametre("statut", event.target.value)}
        defaultValue={searchParams.get("statut") ?? ""}
        className={champ}
      >
        <option value="">Tous états</option>
        {STATUTS.map((statut) => (
          <option key={statut.valeur} value={statut.valeur}>
            {statut.libelle}
          </option>
        ))}
      </select>
      <select
        aria-label="Modèle"
        onChange={(event) => majParametre("modele", event.target.value)}
        defaultValue={searchParams.get("modele") ?? ""}
        className={champ}
      >
        <option value="">Tous modèles</option>
        {modeles.map((modele) => (
          <option key={modele} value={modele}>
            {modele}
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
