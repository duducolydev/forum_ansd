"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { LigneBadge } from "../bulk";

/**
 * Liste des badges, avec cases à cocher (12 novembre 2026).
 *
 * **Toutes les lignes se cochent**, y compris celles sans badge : la
 * sélection sert aussi bien à générer qu'à révoquer, et une case grisée là où
 * il n'y a rien à révoquer empêcherait de demander une génération. C'est
 * chaque action qui dit, par son compteur, sur combien de lignes cochées elle
 * porte vraiment.
 *
 * La sélection vit chez le parent (`gestion-badges.tsx`), qui la partage avec
 * la barre d'actions ; elle ne survit pas à un changement de filtre ou de
 * page, le composant étant remonté avec d'autres lignes.
 */

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
      onChange={(evenement) => onChange(evenement.target.checked)}
      aria-label="Sélectionner toutes les lignes de la page"
      className="accent-primary h-4 w-4"
    />
  );
}

export function BadgesTable({
  lignes,
  total,
  limite,
  selectionnable,
  coches,
  enCours,
  onBasculer,
  onToutBasculer,
}: {
  lignes: LigneBadge[];
  total: number;
  limite: number;
  /** Cases à cocher (permission `badges.generate` ou `badges.revoke`). */
  selectionnable: boolean;
  coches: Set<string>;
  enCours: boolean;
  onBasculer: (participantId: string, valeur: boolean) => void;
  onToutBasculer: (valeur: boolean) => void;
}) {
  const nombreCoches = lignes.filter((ligne) => coches.has(ligne.participantId)).length;
  const tousCoches = lignes.length > 0 && nombreCoches === lignes.length;

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-text-3 text-xs">
              {selectionnable && (
                <th scope="col" className="w-10 px-2 py-2 text-left font-semibold">
                  <CaseTout
                    coche={tousCoches}
                    partiel={nombreCoches > 0 && !tousCoches}
                    disabled={lignes.length === 0 || enCours}
                    onChange={onToutBasculer}
                  />
                </th>
              )}
              <th scope="col" className="px-2 py-2 text-left font-semibold">
                Participant
              </th>
              <th scope="col" className="px-2 py-2 text-left font-semibold">
                Délégation
              </th>
              <th scope="col" className="px-2 py-2 text-left font-semibold">
                Badge
              </th>
              <th scope="col" className="px-2 py-2 text-right font-semibold">
                Impressions
              </th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((ligne) => (
              <tr key={ligne.participantId} className="border-border border-t">
                {selectionnable && (
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={coches.has(ligne.participantId)}
                      disabled={enCours}
                      onChange={(evenement) =>
                        onBasculer(ligne.participantId, evenement.target.checked)
                      }
                      aria-label={`Sélectionner le badge de ${ligne.nom}`}
                      className="accent-primary h-4 w-4"
                    />
                  </td>
                )}
                <td className="px-2 py-2">
                  <Link
                    href={`/admin/participants/${ligne.participantId}`}
                    className="text-heading font-medium"
                  >
                    {ligne.nom}
                  </Link>
                  <span className="text-text-3 block font-mono text-xs">
                    {ligne.publicId} · {ligne.categorie}
                  </span>
                </td>
                <td className="text-text-2 px-2 py-2">{ligne.delegation ?? "—"}</td>
                <td className="px-2 py-2">
                  {ligne.revoque ? (
                    <span className="bg-danger-soft text-danger-text rounded-md px-2 py-0.5 text-xs font-semibold">
                      Révoqué
                    </span>
                  ) : ligne.genere ? (
                    <span className="flex flex-wrap items-center gap-1.5">
                      <a
                        href={`/api/v1/badges/${ligne.badgeId}/pdf`}
                        target="_blank"
                        rel="noopener"
                        className="text-link text-xs font-semibold"
                      >
                        v{ligne.version} · PDF
                      </a>
                      {ligne.ancienGabarit && (
                        <span className="bg-warn-soft text-warn-text rounded-md px-2 py-0.5 text-xs font-semibold">
                          Ancienne maquette
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-text-3 text-xs">À générer</span>
                  )}
                </td>
                <td className="text-text-2 px-2 py-2 text-right tabular-nums">
                  {ligne.impressions}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > limite && (
        <p className="text-text-3 text-xs">
          {limite} premières lignes affichées sur {total}. Sans case cochée, les actions portent sur
          le périmètre entier du filtre ; dès qu&apos;une case l&apos;est, elles ne portent que sur
          les lignes cochées — donc sur ce qui est visible.
        </p>
      )}
    </>
  );
}
