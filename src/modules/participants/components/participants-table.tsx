"use client";

import { ArrowUpRight } from "lucide-react";
import { LienBouton } from "@/components/ui/bouton";

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
        <b className="text-heading">
          {row.original.firstName} {row.original.lastName}
        </b>
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

export function ParticipantsTable({ data }: { data: ParticipantListItem[] }) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="border-border bg-surface overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
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
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="hover:bg-blue-soft">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="border-border border-b px-3.5 py-3">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
          {table.getRowModel().rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="text-text-3 px-3.5 py-8 text-center">
                Aucun participant.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
