"use client";

import { useRouter } from "next/navigation";

/**
 * Choix libre du jour affiché, en plus des raccourcis.
 *
 * Les raccourcis ne couvrent que les journées du Forum et celles où un scan
 * existe ; ce champ permet de viser n'importe quelle date — préparer
 * l'émargement d'un atelier du lendemain, revoir une journée passée. Changer
 * la date recharge la page : les chiffres et l'export suivent le même `jour`.
 */
export function SelecteurJour({ jour }: { jour: string }) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="presences-jour" className="text-text-3 text-xs font-semibold">
        Date
      </label>
      <input
        id="presences-jour"
        type="date"
        value={jour}
        onChange={(evenement) => {
          const valeur = evenement.target.value;
          if (/^\d{4}-\d{2}-\d{2}$/.test(valeur)) router.push(`/admin/presences?jour=${valeur}`);
        }}
        className="border-border bg-bg text-text rounded-lg border px-3 py-1.5 text-sm"
      />
    </div>
  );
}
