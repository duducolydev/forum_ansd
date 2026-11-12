"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { genererEnLotAction, revoquerEnLotAction } from "../bulk-actions";
import type { FiltreBadges, LigneBadge } from "../bulk";
import type { ModeGeneration, PerimetreLot, ResultatLotBadges } from "../lot";
import { ActionsBadges, type CompteursLot } from "./actions-badges";
import { BadgesTable } from "./badges-table";
import { FiltresBadges } from "./filtres-badges";

/**
 * Écran Badges : filtres, actions de masse et liste, autour d'une **sélection
 * partagée** (12 novembre 2026).
 *
 * La sélection vit ici parce que deux composants en dépendent : le tableau,
 * qui coche, et la barre d'actions, qui annonce le périmètre et compte ce que
 * chaque bouton va traiter. La tenir plus bas obligerait à la dupliquer, et
 * c'est exactement ainsi qu'un écran finit par révoquer autre chose que ce
 * qu'il affiche.
 */

/** Ce que le filtre entier contient, compté en base (la page n'en montre qu'une partie). */
export interface CompteursFiltre {
  total: number;
  manquants: number;
  /** Participants dont le dernier badge est révoqué : à réémettre. */
  revoques: number;
  existants: number;
  ancienGabarit: number;
}

function messageDe(mode: ModeGeneration, resultat: ResultatLotBadges): string {
  if (resultat.traites === 0) {
    if (mode === "manquants") return "Aucun badge à générer dans ce périmètre.";
    if (mode === "reemission") return "Aucun badge révoqué à réémettre dans ce périmètre.";
    return "Aucun badge à refaire dans ce périmètre.";
  }
  if (mode === "reemission") {
    return `${resultat.traites} badge(s) réémis en version suivante et mis en file. Nouveau QR : chaque personne reçoit l'e-mail qui l'invite à le retélécharger.`;
  }
  if (mode === "manquants") {
    // On annonce une mise en file, pas une génération : le rendu se fait en
    // arrière-plan, et dire « générés » ferait chercher des fichiers qui
    // n'existent pas encore.
    return `${resultat.traites} badge(s) mis en file. Le rendu se poursuit en arrière-plan ; actualisez pour suivre.`;
  }
  const quoi = mode === "ancien-gabarit" ? "pour la nouvelle maquette" : "à l'identique";
  return `${resultat.traites} badge(s) remis en file ${quoi}. Même QR, aucun e-mail ; actualisez pour suivre.`;
}

export function GestionBadges({
  lignes,
  limite,
  compteurs,
  categories,
  delegations,
  peutGenerer,
  peutRevoquer,
}: {
  lignes: LigneBadge[];
  limite: number;
  compteurs: CompteursFiltre;
  categories: { id: string; labelFr: string }[];
  delegations: { id: string; name: string }[];
  peutGenerer: boolean;
  peutRevoquer: boolean;
}) {
  const parametres = useSearchParams();
  const router = useRouter();
  const [coches, setCoches] = useState<Set<string>>(() => new Set());
  const [enCours, startTransition] = useTransition();
  const [bilan, setBilan] = useState<{ ton: "ok" | "alerte"; lignes: string[] } | null>(null);

  // Le filtre part vers le serveur tel qu'il est écrit dans l'URL : un `etat`
  // inconnu y est écarté ici plutôt que renvoyé en erreur de validation.
  const etat = parametres.get("etat");
  const filtre: FiltreBadges = {
    categoryId: parametres.get("categoryId") || undefined,
    delegationId: parametres.get("delegationId") || undefined,
    etat: etat === "SANS" || etat === "AVEC" || etat === "REVOQUE" ? etat : undefined,
  };

  // Sélection effective : ce qui est coché **et** encore affiché. Après un
  // traitement ou un changement de filtre, les cases disparues tombent
  // d'elles-mêmes, et le périmètre revient au filtre.
  const selection = useMemo(
    () => lignes.filter((ligne) => coches.has(ligne.participantId)),
    [lignes, coches],
  );
  const surSelection = selection.length > 0;

  const comptes: CompteursLot = surSelection
    ? {
        manquants: selection.filter((ligne) => !ligne.revoque && !ligne.genere).length,
        aReemettre: selection.filter((ligne) => ligne.revoque).length,
        existants: selection.filter((ligne) => ligne.genere && !ligne.revoque).length,
        ancienGabarit: selection.filter((ligne) => ligne.ancienGabarit).length,
        revocables: selection.filter((ligne) => ligne.badgeId !== null && !ligne.revoque).length,
      }
    : {
        manquants: compteurs.manquants,
        aReemettre: compteurs.revoques,
        existants: compteurs.existants,
        ancienGabarit: compteurs.ancienGabarit,
        revocables: compteurs.existants,
      };

  const perimetre: PerimetreLot = surSelection
    ? { mode: "selection", participantIds: selection.map((ligne) => ligne.participantId) }
    : { mode: "filtre", filtre };

  function basculer(participantId: string, valeur: boolean) {
    setCoches((avant) => {
      const apres = new Set(avant);
      if (valeur) apres.add(participantId);
      else apres.delete(participantId);
      return apres;
    });
  }

  function toutBasculer(valeur: boolean) {
    setCoches(valeur ? new Set(lignes.map((ligne) => ligne.participantId)) : new Set());
  }

  /** Lignes de bilan communes : ce qui a été mis de côté, et ce qui reste. */
  function details(resultat: ResultatLotBadges): string[] {
    const suite = resultat.ignores.map((ignore) => `Non traité — ${ignore.nom} : ${ignore.raison}`);
    if (resultat.ignoresTotal > resultat.ignores.length) {
      suite.push(
        `… et ${resultat.ignoresTotal - resultat.ignores.length} autre(s) laissé(s) de côté.`,
      );
    }
    if (resultat.reste > 0) {
      suite.push(
        `${resultat.reste} cible(s) au-delà du maximum d'un lot : relancez l'action pour la suite.`,
      );
    }
    return suite;
  }

  function generer(mode: ModeGeneration) {
    setBilan(null);
    startTransition(async () => {
      const reponse = await genererEnLotAction(perimetre, mode);
      if (reponse.error || !reponse.resultat) {
        setBilan({ ton: "alerte", lignes: [reponse.error ?? "La mise en file a échoué."] });
        return;
      }
      const suite = details(reponse.resultat);
      setBilan({
        ton: suite.length > 0 ? "alerte" : "ok",
        lignes: [messageDe(mode, reponse.resultat), ...suite],
      });
      setCoches(new Set());
      router.refresh();
    });
  }

  function revoquer(motif: string) {
    setBilan(null);
    startTransition(async () => {
      const reponse = await revoquerEnLotAction(perimetre, motif);
      if (reponse.error || !reponse.resultat) {
        setBilan({ ton: "alerte", lignes: [reponse.error ?? "La révocation a échoué."] });
        return;
      }
      const suite = details(reponse.resultat);
      setBilan({
        ton: suite.length > 0 ? "alerte" : "ok",
        lignes: [`${reponse.resultat.traites} badge(s) révoqué(s).`, ...suite],
      });
      setCoches(new Set());
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="border-border bg-surface flex flex-col gap-4 rounded-xl border p-4">
        <FiltresBadges
          categories={categories}
          delegations={delegations}
          total={compteurs.total}
          aGenerer={compteurs.manquants}
        />
      </div>

      {(peutGenerer || peutRevoquer) && (
        /*
         * La barre d'actions **suit le défilement dès qu'une case est cochée** :
         * on coche quelques lignes au milieu d'une liste de deux cents, et le
         * bouton reste sous les yeux avec son compte à jour. Sans sélection,
         * elle reprend sa place pour ne pas manger l'écran.
         */
        <div
          className={
            "border-border bg-surface flex flex-col gap-4 rounded-xl border p-4" +
            (surSelection ? " sticky top-4 z-10 shadow-lg" : "")
          }
        >
          <ActionsBadges
            surSelection={surSelection}
            taillePerimetre={surSelection ? selection.length : compteurs.total}
            compteurs={comptes}
            peutGenerer={peutGenerer}
            peutRevoquer={peutRevoquer}
            enCours={enCours}
            onGenerer={generer}
            onRevoquer={revoquer}
            onToutDeselectionner={() => setCoches(new Set())}
          />

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

      {lignes.length === 0 ? (
        <p className="text-text-2 text-sm">Aucun participant dans ce périmètre.</p>
      ) : (
        <BadgesTable
          lignes={lignes}
          total={compteurs.total}
          limite={limite}
          selectionnable={peutGenerer || peutRevoquer}
          coches={coches}
          enCours={enCours}
          onBasculer={basculer}
          onToutBasculer={toutBasculer}
        />
      )}
    </div>
  );
}
