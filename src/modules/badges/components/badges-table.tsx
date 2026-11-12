"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldOff } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { confirmer } from "@/components/ui/confirmer";
import { revoquerEnLotAction } from "../bulk-actions";
import type { LigneBadge } from "../bulk";

/**
 * Liste des badges, avec révocation groupée (12 novembre 2026).
 *
 * Seules les lignes qui ont un **badge valide** se cochent : une ligne sans
 * badge ou déjà révoquée n'a rien à révoquer, et laisser sa case cliquable
 * ferait croire que « tout cocher » porte sur plus de monde qu'en réalité.
 *
 * La sélection ne survit pas à un changement de filtre ou de page : les
 * filtres passent par l'URL, donc le composant est remonté avec d'autres
 * lignes, et le compteur de la barre ne peut pas annoncer des gens qu'on ne
 * voit plus.
 */

/** Seuls les badges valides se révoquent. */
const selectionnable = (ligne: LigneBadge) => ligne.badgeId !== null && !ligne.revoque;

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
      aria-label="Sélectionner tous les badges valides de la page"
      className="accent-primary h-4 w-4"
    />
  );
}

export function BadgesTable({
  lignes,
  total,
  limite,
  peutRevoquer,
}: {
  lignes: LigneBadge[];
  total: number;
  limite: number;
  /** Cases à cocher et révocation groupée (permission `badges.revoke`). */
  peutRevoquer: boolean;
}) {
  const router = useRouter();
  const [coches, setCoches] = useState<Set<string>>(() => new Set());
  const [motif, setMotif] = useState("");
  const [enCours, startTransition] = useTransition();
  const [bilan, setBilan] = useState<{ ton: "ok" | "alerte"; lignes: string[] } | null>(null);

  const eligibles = useMemo(() => lignes.filter(selectionnable), [lignes]);
  // Sélection effective : ce qui est coché **et** encore affiché comme
  // révocable. Après un traitement, les cases disparues tombent d'elles-mêmes.
  const selection = eligibles.filter((ligne) => coches.has(ligne.badgeId!));
  const tousCoches = eligibles.length > 0 && selection.length === eligibles.length;
  const motifRempli = motif.trim().length > 0;

  function basculer(badgeId: string, valeur: boolean) {
    setCoches((avant) => {
      const apres = new Set(avant);
      if (valeur) apres.add(badgeId);
      else apres.delete(badgeId);
      return apres;
    });
  }

  function toutBasculer(valeur: boolean) {
    setCoches(valeur ? new Set(eligibles.map((ligne) => ligne.badgeId!)) : new Set());
  }

  function revoquer() {
    const cibles = selection;
    const n = cibles.length;
    void confirmer({
      titre: `Révoquer ${n} badge(s) ?`,
      texte: `Aucun nouveau badge n'est émis : ces ${n} QR cessent immédiatement d'être valides et les personnes se verront refuser l'accès à tous les points de contrôle. Une erreur se rattrape fiche par fiche avec la réémission.`,
      confirmer: `Révoquer ${n} badge(s)`,
      ton: "danger",
    }).then((accepte) => {
      if (!accepte) return;
      setBilan(null);
      startTransition(async () => {
        const reponse = await revoquerEnLotAction(
          cibles.map((ligne) => ligne.badgeId!),
          motif,
        );
        if (reponse.error || !reponse.resultat) {
          setBilan({ ton: "alerte", lignes: [reponse.error ?? "La révocation a échoué."] });
          return;
        }
        const { revoques, ignores } = reponse.resultat;
        setBilan({
          ton: ignores.length > 0 ? "alerte" : "ok",
          lignes: [
            `${revoques} badge(s) révoqué(s).`,
            ...ignores.map((ignore) => `Non révoqué — ${ignore.nom} : ${ignore.raison}`),
          ],
        });
        setCoches(new Set());
        setMotif("");
        router.refresh();
      });
    });
  }

  if (lignes.length === 0) {
    return <p className="text-text-2 text-sm">Aucun participant dans ce périmètre.</p>;
  }

  return (
    <>
      {peutRevoquer && (selection.length > 0 || bilan) && (
        <div className="border-border bg-surface flex flex-col gap-3 rounded-xl border p-3.5">
          {selection.length > 0 && (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex min-w-64 flex-1 flex-col gap-1.5">
                  <label htmlFor="motif-lot" className="text-text-3 text-xs font-semibold">
                    Motif de révocation (badge perdu, erreur de saisie, exclusion…)
                  </label>
                  <input
                    id="motif-lot"
                    value={motif}
                    onChange={(evenement) => setMotif(evenement.target.value)}
                    disabled={enCours}
                    className="border-border bg-bg text-text rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
                <Bouton
                  ton="danger"
                  icone={ShieldOff}
                  type="button"
                  disabled={enCours || !motifRempli}
                  titre={motifRempli ? undefined : "Renseignez d'abord un motif."}
                  onClick={revoquer}
                >
                  {enCours ? "Révocation…" : `Révoquer ${selection.length} badge(s)`}
                </Bouton>
                <Bouton
                  ton="discret"
                  type="button"
                  disabled={enCours}
                  onClick={() => setCoches(new Set())}
                >
                  Tout désélectionner
                </Bouton>
              </div>
              <p className="text-text-3 text-xs">
                Le même motif est enregistré pour les {selection.length} badges. Aucun badge
                n&apos;est réémis et aucun e-mail n&apos;est envoyé : la réémission se fait fiche
                par fiche.
              </p>
            </>
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

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-text-3 text-xs">
              {peutRevoquer && (
                <th scope="col" className="w-10 px-2 py-2 text-left font-semibold">
                  <CaseTout
                    coche={tousCoches}
                    partiel={selection.length > 0 && !tousCoches}
                    disabled={eligibles.length === 0 || enCours}
                    onChange={toutBasculer}
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
                {peutRevoquer && (
                  <td className="px-2 py-2">
                    {selectionnable(ligne) && (
                      <input
                        type="checkbox"
                        checked={coches.has(ligne.badgeId!)}
                        disabled={enCours}
                        onChange={(evenement) => basculer(ligne.badgeId!, evenement.target.checked)}
                        aria-label={`Sélectionner le badge de ${ligne.nom}`}
                        className="accent-primary h-4 w-4"
                      />
                    )}
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
                    <a
                      href={`/api/v1/badges/${ligne.badgeId}/pdf`}
                      target="_blank"
                      rel="noopener"
                      className="text-link text-xs font-semibold"
                    >
                      v{ligne.version} · PDF
                    </a>
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
          {limite} premières lignes affichées sur {total}. La génération, l&apos;export et la
          planche portent sur le périmètre entier ; la révocation ne porte que sur les lignes
          cochées.
        </p>
      )}
    </>
  );
}
