"use client";

import { useActionState } from "react";
import {
  CircleCheck,
  FileSpreadsheet,
  MicVocal,
  RotateCcw,
  SearchCheck,
  TriangleAlert,
} from "lucide-react";
import { Bouton, LienBouton, LienExterne } from "@/components/ui/bouton";
import { ZoneDepot } from "@/components/ui/zone-depot";
import {
  apercuImportIntervenantsAction,
  confirmerImportIntervenantsAction,
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
 * Import d'intervenants en trois écrans : dépôt du fichier, aperçu à vérifier,
 * bilan. Rien n'est écrit avant le clic sur « Créer ».
 */
export function ImportIntervenants() {
  const [apercu, actionApercu, apercuEnCours] = useActionState(
    apercuImportIntervenantsAction,
    apercuInitial,
  );
  const [bilan, actionConfirmation, confirmationEnCours] = useActionState(
    confirmerImportIntervenantsAction,
    confirmationInitial,
  );

  if (bilan.crees !== undefined) {
    const rattachements = bilan.rattachements ?? 0;
    return (
      <div className="flex flex-col gap-4">
        <div
          role="status"
          className="border-accent-text bg-accent-soft text-accent-text flex items-start gap-3 rounded-xl border p-5"
        >
          <CircleCheck aria-hidden size={20} className="mt-0.5 shrink-0" />
          <p>
            <strong>
              {bilan.crees} intervenant{bilan.crees > 1 ? "s" : ""} créé
              {bilan.crees > 1 ? "s" : ""}
              {rattachements > 0
                ? `, ${rattachements} rattachement${rattachements > 1 ? "s" : ""} aux séances`
                : ""}
              .
            </strong>{" "}
            Les fiches non publiées restent invisibles sur le site jusqu&apos;à leur relecture.
          </p>
        </div>
        <ListeErreurs
          erreurs={bilan.echecs ?? []}
          titre={`${bilan.echecs?.length ?? 0} ligne(s) à reprendre`}
        />
        <div className="flex flex-wrap gap-3">
          <LienBouton href="/admin/intervenants" ton="principal">
            Voir les intervenants
          </LienBouton>
          {/* Lien classique : un rechargement complet remet l'import à zéro. */}
          <LienExterne href="/admin/intervenants/importer" icone={RotateCcw}>
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
            Fichier des intervenants
          </label>
          <ZoneDepot
            id="fichier"
            name="fichier"
            libelle="Fichier des intervenants"
            icone={FileSpreadsheet}
            accept=".xlsx,.xls,.csv"
            required
            aide="Classeur .xlsx, .xls ou fichier .csv — 2 Mo et 500 lignes au plus"
          />
          <p className="text-text-3 text-xs">
            Partez du modèle : colonnes obligatoires <code>prenom</code> et <code>nom</code> ;{" "}
            <code>email</code> fortement recommandée. Les séances se désignent par leur numéro ou
            leur titre ; la feuille « Aide » du modèle détaille chaque colonne.
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
  const sansAdresse = lignes.filter((ligne) => !ligne.email).length;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-heading font-semibold">
        {nombre} intervenant{nombre > 1 ? "s" : ""} prêt{nombre > 1 ? "s" : ""} à être créé
        {nombre > 1 ? "s" : ""}
        {apercu.erreurs && apercu.erreurs.length > 0
          ? `, ${apercu.erreurs.length} ligne(s) écartée(s).`
          : "."}
      </p>

      <ListeErreurs
        erreurs={apercu.erreurs ?? []}
        titre={`${apercu.erreurs?.length ?? 0} ligne(s) écartée(s) — corrigez le fichier puis rechargez-le pour les créer`}
      />

      {sansAdresse > 0 && (
        <p className="border-warn-text/40 bg-warn-soft text-warn-text rounded-xl border p-3 text-sm">
          {sansAdresse} intervenant{sansAdresse > 1 ? "s" : ""} sans adresse : ils ne pourront pas
          recevoir leur lien d&apos;accès tant que leur fiche n&apos;est pas complétée.
        </p>
      )}

      {nombre > 0 && (
        <div className="border-border bg-surface max-h-[28rem] overflow-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="sticky top-0">
              <tr>
                <th className={TH}>Ligne</th>
                <th className={TH}>Intervenant</th>
                <th className={TH}>E-mail</th>
                <th className={TH}>Séances</th>
                <th className={TH}>Site</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((ligne) => (
                <tr key={ligne.rowNumber}>
                  <td className={`${TD} text-text-3`}>{ligne.rowNumber}</td>
                  <td className={TD}>
                    <span className="text-heading font-semibold">{ligne.nom}</span>
                    <span className="text-text-3 block text-xs">{ligne.profil || "—"}</span>
                  </td>
                  <td className={TD}>
                    {ligne.email || <span className="text-danger-text text-xs">aucune</span>}
                  </td>
                  <td className={TD}>
                    {ligne.seances.length === 0 ? (
                      "—"
                    ) : (
                      <>
                        {ligne.seances.map((titre) => (
                          <span key={titre} className="block text-xs">
                            {titre}
                          </span>
                        ))}
                        <span className="text-text-3 block text-xs">{ligne.role}</span>
                      </>
                    )}
                  </td>
                  <td className={`${TD} text-xs`}>
                    {ligne.publie ? "Publié" : "Brouillon"}
                    {ligne.misEnAvant && (
                      <span className="bg-gold-soft text-gold-text ml-1.5 rounded-full px-2 py-0.5 font-semibold">
                        accueil
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-border bg-surface-2 text-text-2 rounded-xl border p-4 text-sm">
        À la confirmation, chaque fiche est créée puis rattachée à ses séances. Aucun e-mail ne part
        : l&apos;intervenant demande son lien d&apos;accès depuis l&apos;espace intervenant, avec
        l&apos;adresse importée. Les intervenants déjà enregistrés ne sont pas modifiés.
      </div>

      <form action={actionConfirmation} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="lot" value={apercu.lot} />
        <Bouton
          ton="principal"
          icone={MicVocal}
          type="submit"
          disabled={confirmationEnCours || nombre === 0}
        >
          {confirmationEnCours
            ? "Création en cours…"
            : `Créer ${nombre} intervenant${nombre > 1 ? "s" : ""}`}
        </Bouton>
        {/* Rechargement complet : l'import repart de zéro. */}
        <LienExterne href="/admin/intervenants/importer" ton="discret" icone={RotateCcw}>
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
