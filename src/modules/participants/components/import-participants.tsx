"use client";

import { useActionState } from "react";
import {
  CircleCheck,
  FileSpreadsheet,
  RotateCcw,
  SearchCheck,
  TriangleAlert,
  UserPlus,
} from "lucide-react";
import { Bouton, LienBouton, LienExterne } from "@/components/ui/bouton";
import { ZoneDepot } from "@/components/ui/zone-depot";
import {
  apercuImportAction,
  confirmerImportAction,
  type EtatApercu,
  type EtatConfirmation,
} from "../import-actions";
import type { ErreurLigne } from "../import";

const apercuInitial: EtatApercu = {};
const confirmationInitial: EtatConfirmation = {};

const TH =
  "border-border bg-surface-2 text-text-3 border-b px-3 py-2.5 text-left text-xs font-semibold";
const TD = "border-border border-b px-3 py-2.5 align-top";

function ListeErreurs({ erreurs, titre }: { erreurs: ErreurLigne[]; titre: string }) {
  if (erreurs.length === 0) return null;
  return (
    <details open className="border-warn-text/40 bg-warn-soft rounded-xl border p-4">
      <summary className="text-warn-text flex cursor-pointer items-center gap-2 text-sm font-semibold">
        <TriangleAlert aria-hidden size={16} />
        {titre}
      </summary>
      <ul className="text-text mt-3 max-h-64 overflow-y-auto text-sm">
        {erreurs.map((erreur) => (
          <li key={`${erreur.rowNumber}-${erreur.message}`} className="py-0.5">
            <strong>Ligne {erreur.rowNumber}</strong> : {erreur.message}
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * Import de participants en trois écrans : dépôt du fichier, aperçu à
 * vérifier, bilan. Rien n'est écrit avant le clic sur « Inscrire ».
 */
export function ImportParticipants() {
  const [apercu, actionApercu, apercuEnCours] = useActionState(apercuImportAction, apercuInitial);
  const [bilan, actionConfirmation, confirmationEnCours] = useActionState(
    confirmerImportAction,
    confirmationInitial,
  );

  if (bilan.inscrits !== undefined) {
    return (
      <div className="flex flex-col gap-4">
        <div
          role="status"
          className="border-accent-text bg-accent-soft text-accent-text flex items-start gap-3 rounded-xl border p-5"
        >
          <CircleCheck aria-hidden size={20} className="mt-0.5 shrink-0" />
          <p>
            <strong>
              {bilan.inscrits} participant{bilan.inscrits > 1 ? "s" : ""} inscrit
              {bilan.inscrits > 1 ? "s" : ""}.
            </strong>{" "}
            Chacun reçoit un e-mail avec l&apos;accès direct à son espace ; les badges sont en cours
            de génération et seront annoncés par un second e-mail.
          </p>
        </div>
        <ListeErreurs
          erreurs={bilan.echecs ?? []}
          titre={`${bilan.echecs?.length ?? 0} ligne(s) non inscrite(s)`}
        />
        <div className="flex flex-wrap gap-3">
          <LienBouton href="/admin/participants" ton="principal">
            Voir les participants
          </LienBouton>
          {/* Lien classique : un rechargement complet remet l'import à zéro. */}
          <LienExterne href="/admin/participants/importer" icone={RotateCcw}>
            Importer un autre fichier
          </LienExterne>
        </div>
      </div>
    );
  }

  if (!apercu.lot) {
    return (
      <form action={actionApercu} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="fichier" className="text-heading text-sm font-semibold">
            Fichier des participants
          </label>
          <ZoneDepot
            id="fichier"
            name="fichier"
            libelle="Fichier des participants"
            icone={FileSpreadsheet}
            accept=".xlsx,.xls,.csv"
            required
            aide="Classeur .xlsx, .xls ou fichier .csv — 2 Mo et 2 000 lignes au plus"
          />
          <p className="text-text-3 text-xs">
            Partez du modèle : colonnes obligatoires <code>prenom</code>, <code>nom</code>,{" "}
            <code>email</code>, <code>pays</code> et <code>categorie</code> (code ou libellé). Les
            autres sont facultatives ; la feuille « Aide » du modèle les détaille.
          </p>
        </div>
        {apercu.erreur && (
          <p role="alert" className="text-danger-text text-sm">
            {apercu.erreur}
          </p>
        )}
        <div>
          <Bouton ton="principal" icone={SearchCheck} type="submit" disabled={apercuEnCours}>
            {apercuEnCours ? "Vérification…" : "Vérifier le fichier"}
          </Bouton>
        </div>
      </form>
    );
  }

  const lignes = apercu.lignes ?? [];
  const nombre = lignes.length;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-heading font-semibold">
        {nombre} personne{nombre > 1 ? "s" : ""} prête{nombre > 1 ? "s" : ""} à être inscrite
        {nombre > 1 ? "s" : ""}
        {apercu.erreurs && apercu.erreurs.length > 0
          ? `, ${apercu.erreurs.length} ligne(s) écartée(s).`
          : "."}
      </p>

      <ListeErreurs
        erreurs={apercu.erreurs ?? []}
        titre={`${apercu.erreurs?.length ?? 0} ligne(s) écartée(s) — corrigez le fichier puis rechargez-le pour les inscrire`}
      />

      {nombre > 0 && (
        <div className="border-border bg-surface max-h-[28rem] overflow-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="sticky top-0">
              <tr>
                <th className={TH}>Ligne</th>
                <th className={TH}>Nom</th>
                <th className={TH}>E-mail</th>
                <th className={TH}>Catégorie</th>
                <th className={TH}>Pays</th>
                <th className={TH}>Organisation</th>
                <th className={TH}>Délégation</th>
                <th className={TH}>Cérémonies</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((ligne) => (
                <tr key={ligne.rowNumber}>
                  <td className={`${TD} text-text-3`}>{ligne.rowNumber}</td>
                  <td className={`${TD} text-heading font-semibold`}>{ligne.nom}</td>
                  <td className={TD}>{ligne.email}</td>
                  <td className={TD}>
                    {ligne.categorie}
                    {ligne.presse && (
                      <span className="bg-gold-soft text-gold-text ml-1.5 rounded-full px-2 py-0.5 text-xs font-semibold">
                        accréditée
                      </span>
                    )}
                  </td>
                  <td className={TD}>{ligne.pays}</td>
                  <td className={TD}>{ligne.organisation || "—"}</td>
                  <td className={TD}>{ligne.delegation ?? "—"}</td>
                  <td className={TD}>{ligne.jours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-border bg-surface-2 text-text-2 rounded-xl border p-4 text-sm">
        À la confirmation, chaque personne est inscrite <strong>confirmée</strong>, son badge est
        généré, et elle reçoit un e-mail qui ouvre directement son espace : vérifier et compléter
        ses informations, ajouter sa photo, télécharger son badge.
      </div>

      <form action={actionConfirmation} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="lot" value={apercu.lot} />
        <Bouton
          ton="principal"
          icone={UserPlus}
          type="submit"
          disabled={confirmationEnCours || nombre === 0}
        >
          {confirmationEnCours
            ? "Inscription en cours…"
            : `Inscrire ${nombre} participant${nombre > 1 ? "s" : ""} et les prévenir`}
        </Bouton>
        {/* Rechargement complet : l'import repart de zéro. */}
        <LienExterne href="/admin/participants/importer" ton="discret" icone={RotateCcw}>
          Charger un autre fichier
        </LienExterne>
        {bilan.erreur && (
          <p role="alert" className="text-danger-text w-full text-sm">
            {bilan.erreur}
          </p>
        )}
      </form>
    </div>
  );
}
