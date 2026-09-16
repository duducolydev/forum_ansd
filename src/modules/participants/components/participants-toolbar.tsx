"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { STATUS_LABELS } from "./status-badge";

export function ParticipantsToolbar({
  categories,
}: {
  categories: { id: string; labelFr: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [, startTransition] = useTransition();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  return (
    <div className="mb-3 flex flex-wrap gap-2">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          updateParam("q", q);
        }}
        className="min-w-[220px] flex-1"
      >
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Nom, e-mail, organisation, identifiant…"
          className="border-border bg-surface text-text w-full rounded-lg border px-3 py-2 text-sm"
        />
      </form>
      <select
        onChange={(event) => updateParam("status", event.target.value)}
        defaultValue={searchParams.get("status") ?? ""}
        className="border-border bg-surface text-text rounded-lg border px-3 py-2 text-sm"
      >
        <option value="">Tous statuts</option>
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <select
        onChange={(event) => updateParam("categoryId", event.target.value)}
        defaultValue={searchParams.get("categoryId") ?? ""}
        className="border-border bg-surface text-text rounded-lg border px-3 py-2 text-sm"
      >
        <option value="">Toutes catégories</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.labelFr}
          </option>
        ))}
      </select>
    </div>
  );
}
