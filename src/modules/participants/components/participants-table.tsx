"use client";

import { avecCivilite } from "@/lib/civilite";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Check, X } from "lucide-react";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { confirmer } from "@/components/ui/confirmer";

// @tanstack/react-table v9 a renommé l'API "classique" en API "legacy" (le
// nouveau `useTable` a une architecture différente) — cf. PLAN.md.
import {
  getCoreRowModel,
  useLegacyTable as useReactTable,
  type LegacyColumnDef as ColumnDef,
} from "@tanstack/react-table/legacy";
import { flexRender } from "@tanstack/react-table/flex-render";
import { StatusBadge } from "./status-badge";
import type { ParticipantListItem } from "../repository";
import { traiterEnLotAction } from "../actions";
import type { OperationLot } from "../lot";

/** Seules les inscriptions en attente se confirment ou se déclinent. */
const selectionnable = (participant: ParticipantListItem) => participant.status === "REGISTERED";

const nomDe = (participant: ParticipantListItem) =>
  avecCivilite(participant.civility, `${participant.firstName} ${participant.lastName}`);

const columns: ColumnDef<ParticipantListItem>[] = [
  {
    accessorKey: "publicId",
    header: "Identifiant",
    cell: ({ row }) => row.original.publicId,
  },
  {
    id: "name",
    header: "Participant",
    cell: ({ row }) => (
      <div>
        <b className="text-heading">{nomDe(row.original)}</b>
        <div className="text-text-3 text-sm">{row.original.email}</div>
      </div>
    ),
  },
  {
    accessorKey: "organization",
    header: "Organisation",
    cell: ({ row }) => row.original.organization ?? "—",
  },
  { accessorKey: "country", header: "Pays" },
  {
    id: "category",
    header: "Catégorie",
    cell: ({ row }) => row.original.category.labelFr,
  },
  {
    id: "status",
    header: "Statut",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: "badge",
    header: "Badge",
    cell: ({ row }) => {
      const badge = row.original.badges[0];
      if (!badge) return "—";
      return badge.revokedAt ? `v${badge.version} (révoqué)` : `v${badge.version}`;
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <LienBouton
        href={`/admin/participants/${row.original.id}`}
        ton="discret"
        taille="petit"
        icone={ArrowUpRight}
      >
        Ouvrir
      </LienBouton>
    ),
  },
];

/** Case d'en-tête : cochée, vide, ou « en partie » quand une partie de la page l'est. */
function CaseTout({
  coche,
  partiel,
  disabled,
  onChange,
}: {
  coche: boolean;
  partiel: boolean;
  disabled: boolean;
  onChange: (valeur: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = partiel;
  }, [partiel]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={coche}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
      aria-label="Sélectionner toutes les inscriptions en attente de la page"
      className="accent-primary h-4 w-4"
    />
  );
}

export function ParticipantsTable({
  data,
  traitementEnLot = false,
}: {
  data: ParticipantListItem[];
  /** Cases à cocher et confirmation groupée (permission `participants.write`). */
  traitementEnLot?: boolean;
}) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });
  const router = useRouter();
  const [coches, setCoches] = useState<Set<string>>(() => new Set());
  const [enCours, startTransition] = useTransition();
  const [bilan, setBilan] = useState<{ ton: "ok" | "alerte"; lignes: string[] } | null>(null);

  const eligibles = useMemo(() => data.filter(selectionnable), [data]);
  // Sélection effective : ce qui est coché **et** encore affiché en attente.
  // Après un changement de page, de filtre ou un traitement, les cases
  // disparues tombent d'elles-mêmes.
  const selection = eligibles.filter((participant) => coches.has(participant.id));
  const tousCoches = eligibles.length > 0 && selection.length === eligibles.length;

  function basculer(id: string, valeur: boolean) {
    setCoches((avant) => {
      const apres = new Set(avant);
      if (valeur) apres.add(id);
      else apres.delete(id);
      return apres;
    });
  }

  function toutBasculer(valeur: boolean) {
    setCoches(valeur ? new Set(eligibles.map((participant) => participant.id)) : new Set());
  }

  function lancer(operation: OperationLot) {
    const cibles = selection;
    const n = cibles.length;
    const confirme = operation === "confirm";
    void confirmer(
      confirme
        ? {
            titre: `Confirmer ${n} participation(s) ?`,
            texte:
              "Chaque personne reçoit l'e-mail de confirmation avec l'accès à son espace, et son badge est généré. Les demandes d'accréditation presse ne sont traitées que si vous avez le droit d'accréditer.",
            confirmer: `Confirmer ${n} participation(s)`,
            ton: "neutre",
          }
        : {
            titre: `Décliner ${n} inscription(s) ?`,
            texte:
              "Ces personnes ne pourront plus accéder à leur espace. Une erreur se rattrape fiche par fiche avec « Réactiver ».",
            confirmer: `Décliner ${n} inscription(s)`,
            ton: "danger",
          },
    ).then((accepte) => {
      if (!accepte) return;
      setBilan(null);
      startTransition(async () => {
        const reponse = await traiterEnLotAction(
          cibles.map((participant) => participant.id),
          operation,
        );
        if (reponse.error || !reponse.resultat) {
          setBilan({ ton: "alerte", lignes: [reponse.error ?? "Le traitement a échoué."] });
          return;
        }
        const { traites, ignores } = reponse.resultat;
        const noms = new Map(cibles.map((participant) => [participant.id, nomDe(participant)]));
        setBilan({
          ton: ignores.length > 0 ? "alerte" : "ok",
          lignes: [
            `${traites} inscription(s) ${confirme ? "confirmée(s)" : "déclinée(s)"}.`,
            ...ignores.map(
              (ignore) => `Non traitée — ${noms.get(ignore.id) ?? ignore.id} : ${ignore.raison}`,
            ),
          ],
        });
        setCoches(new Set());
        router.refresh();
      });
    });
  }

  return (
    <>
      {traitementEnLot && (selection.length > 0 || bilan) && (
        <div className="border-border bg-surface mb-3 flex flex-col gap-2 rounded-xl border p-3.5">
          {selection.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-heading mr-2 text-sm font-semibold">
                {selection.length} sélectionné(s)
              </span>
              <Bouton
                ton="principal"
                taille="petit"
                icone={Check}
                disabled={enCours}
                onClick={() => lancer("confirm")}
              >
                {enCours ? "Traitement…" : "Confirmer la sélection"}
              </Bouton>
              <Bouton
                ton="secondaire"
                taille="petit"
                icone={X}
                disabled={enCours}
                onClick={() => lancer("decline")}
              >
                Décliner la sélection
              </Bouton>
              <Bouton
                ton="discret"
                taille="petit"
                disabled={enCours}
                onClick={() => setCoches(new Set())}
              >
                Tout désélectionner
              </Bouton>
            </div>
          )}
          {bilan && (
            <ul
              role="status"
              className={`flex flex-col gap-0.5 text-sm ${
                bilan.ton === "ok" ? "text-accent-text" : "text-warn-text"
              }`}
            >
              {bilan.lignes.map((ligne) => (
                <li key={ligne}>{ligne}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="border-border bg-surface overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {traitementEnLot && (
                  <th className="border-border bg-surface-2 w-10 border-b py-3 pl-3.5">
                    <CaseTout
                      coche={tousCoches}
                      partiel={selection.length > 0 && !tousCoches}
                      disabled={eligibles.length === 0 || enCours}
                      onChange={toutBasculer}
                    />
                  </th>
                )}
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="border-border bg-surface-2 text-text-3 border-b px-3.5 py-3 text-left text-xs font-semibold"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const coche = coches.has(row.original.id) && selectionnable(row.original);
              return (
                <tr key={row.id} className={coche ? "bg-blue-soft" : "hover:bg-blue-soft"}>
                  {traitementEnLot && (
                    <td className="border-border w-10 border-b py-3 pl-3.5">
                      {selectionnable(row.original) && (
                        <input
                          type="checkbox"
                          checked={coche}
                          disabled={enCours}
                          onChange={(event) => basculer(row.original.id, event.target.checked)}
                          aria-label={`Sélectionner ${nomDe(row.original)}`}
                          className="accent-primary h-4 w-4"
                        />
                      )}
                    </td>
                  )}
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="border-border border-b px-3.5 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + (traitementEnLot ? 1 : 0)}
                  className="text-text-3 px-3.5 py-8 text-center"
                >
                  Aucun participant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
