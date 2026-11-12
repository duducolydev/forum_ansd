"use client";

import { useState } from "react";
import { RefreshCw, ShieldOff, Sparkles } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { confirmer } from "@/components/ui/confirmer";
import type { ModeGeneration } from "../lot";

/** Ce que le périmètre courant contient, action par action. */
export interface CompteursLot {
  /** Participants sans badge valide : première génération. */
  manquants: number;
  /** Badges valides, qu'on peut refaire à version constante. */
  existants: number;
  /** Badges valides rendus avec un gabarit antérieur. */
  ancienGabarit: number;
  /** Badges valides, donc révocables. */
  revocables: number;
}

/**
 * Actions de masse de l'écran Badges, pour le périmètre courant
 * (12 novembre 2026).
 *
 * **Le périmètre est annoncé en toutes lettres** au-dessus des boutons : tant
 * qu'aucune ligne n'est cochée, un clic porte sur tout ce que le filtre
 * affiche ; dès qu'une case l'est, il ne porte plus que sur les lignes
 * cochées. C'est la seule façon d'avoir à la fois « toute la délégation du
 * Mali » et « ces trois personnes-là » sans deux jeux de boutons qu'on
 * finirait par confondre.
 *
 * Chaque bouton porte **son propre compte**, celui des lignes du périmètre
 * qu'il concerne vraiment : « Générer 4 badges manquants » sur une sélection
 * de douze dit, sans phrase, que huit ont déjà le leur.
 */
export function ActionsBadges({
  surSelection,
  taillePerimetre,
  compteurs,
  peutGenerer,
  peutRevoquer,
  enCours,
  onGenerer,
  onRevoquer,
  onToutDeselectionner,
}: {
  /** Vrai dès qu'une ligne est cochée : le périmètre devient la sélection. */
  surSelection: boolean;
  taillePerimetre: number;
  compteurs: CompteursLot;
  peutGenerer: boolean;
  peutRevoquer: boolean;
  enCours: boolean;
  onGenerer: (mode: ModeGeneration) => void;
  onRevoquer: (motif: string) => void;
  onToutDeselectionner: () => void;
}) {
  const [revocationOuverte, setRevocationOuverte] = useState(false);
  const [motif, setMotif] = useState("");

  const motifRempli = motif.trim().length > 0;

  function regenerer() {
    void confirmer({
      titre: `Refaire ${compteurs.existants} badge(s) ?`,
      texte:
        "Les badges sont refaits dans leur version : même QR, aucun e-mail, un badge déjà imprimé reste valable. Le rendu occupe la file plusieurs minutes sur un gros lot.",
      confirmer: `Refaire ${compteurs.existants} badge(s)`,
      ton: "neutre",
    }).then((accepte) => {
      if (accepte) onGenerer("existants");
    });
  }

  function revoquer() {
    void confirmer({
      titre: `Révoquer ${compteurs.revocables} badge(s) ?`,
      texte: `Aucun nouveau badge n'est émis : ces ${compteurs.revocables} QR cessent immédiatement d'être valides et les personnes se verront refuser l'accès à tous les points de contrôle. Une erreur se rattrape fiche par fiche avec la réémission.`,
      confirmer: `Révoquer ${compteurs.revocables} badge(s)`,
      ton: "danger",
    }).then((accepte) => {
      if (!accepte) return;
      onRevoquer(motif);
      setRevocationOuverte(false);
      setMotif("");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-text-2 text-sm">
        {surSelection ? (
          <>
            Les actions portent sur{" "}
            <b className="text-heading">
              {taillePerimetre} {taillePerimetre > 1 ? "lignes cochées" : "ligne cochée"}
            </b>
            , à l&apos;intérieur du filtre.{" "}
            <button
              type="button"
              onClick={onToutDeselectionner}
              disabled={enCours}
              className="text-link font-semibold underline"
            >
              Tout désélectionner
            </button>{" "}
            pour revenir au filtre entier.
          </>
        ) : (
          <>
            Les actions portent sur{" "}
            <b className="text-heading">
              {taillePerimetre}{" "}
              {taillePerimetre > 1 ? "participants du filtre" : "participant du filtre"}
            </b>
            , affichés ou non. Cochez des lignes pour viser plus fin.
          </>
        )}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {peutGenerer && (
          <>
            <Bouton
              ton="principal"
              icone={Sparkles}
              type="button"
              disabled={enCours || compteurs.manquants === 0}
              onClick={() => onGenerer("manquants")}
            >
              {enCours ? "Mise en file…" : `Générer ${compteurs.manquants} badge(s) manquant(s)`}
            </Bouton>

            <Bouton
              ton="secondaire"
              icone={RefreshCw}
              type="button"
              disabled={enCours || compteurs.existants === 0}
              titre="Même version, même QR, aucun e-mail : utile après une correction de fiche ou de maquette."
              onClick={regenerer}
            >
              {`Refaire ${compteurs.existants} badge(s) déjà émis`}
            </Bouton>

            {compteurs.ancienGabarit > 0 && (
              <Bouton
                ton="secondaire"
                icone={RefreshCw}
                type="button"
                disabled={enCours}
                titre="Même QR, aucun e-mail : seule l'allure du badge change."
                onClick={() => onGenerer("ancien-gabarit")}
              >
                {`Refaire ${compteurs.ancienGabarit} badge(s) avec la nouvelle maquette`}
              </Bouton>
            )}
          </>
        )}

        {peutRevoquer && (
          <Bouton
            ton="danger"
            icone={ShieldOff}
            type="button"
            disabled={enCours || compteurs.revocables === 0}
            onClick={() => setRevocationOuverte((ouverte) => !ouverte)}
          >
            {`Révoquer ${compteurs.revocables} badge(s)…`}
          </Bouton>
        )}
      </div>

      {peutRevoquer && revocationOuverte && compteurs.revocables > 0 && (
        <div className="border-border flex flex-col gap-3 rounded-lg border p-4">
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
              {enCours ? "Révocation…" : `Révoquer ${compteurs.revocables} badge(s)`}
            </Bouton>
          </div>
          <p className="text-text-3 text-xs">
            Le même motif est enregistré pour les {compteurs.revocables} badges. Aucun badge
            n&apos;est réémis et aucun e-mail n&apos;est envoyé : la réémission se fait fiche par
            fiche.
          </p>
        </div>
      )}
    </div>
  );
}
