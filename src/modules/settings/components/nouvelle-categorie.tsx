"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus, Tags } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { creerCategorieAction, type EtatAction } from "../actions";
import { codeDeCategorie } from "../regles";
import { CHAMP, Retour } from "./champs";

const etatInitial: EtatAction = {};

function Case({
  nom,
  coche = false,
  children,
}: {
  nom: string;
  coche?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="text-text-2 flex items-center gap-2 text-sm whitespace-nowrap">
      <input type="checkbox" name={nom} defaultChecked={coche} />
      {children}
    </label>
  );
}

/**
 * Création d'une catégorie de participants depuis le BackOffice (24 octobre
 * 2026) : le comité d'organisation, distinct du personnel de l'ANSD, en a été
 * le premier besoin.
 *
 * Le code est proposé à partir du libellé, à mesure qu'on le tape ; il reste
 * modifiable jusqu'à la création, puis il est figé. Les zones d'accès se
 * copient d'une catégorie existante : une catégorie sans zone serait refusée à
 * toutes les portes au scan.
 */
export function NouvelleCategorie({
  categories,
}: {
  categories: { id: string; code: string; labelFr: string }[];
}) {
  const [etat, action, enCours] = useActionState(creerCategorieAction, etatInitial);
  const [ouvert, setOuvert] = useState(false);
  const [libelle, setLibelle] = useState("");
  const refForm = useRef<HTMLFormElement>(null);

  // Créée : formulaire vidé, prêt pour la suivante.
  useEffect(() => {
    if (etat.avis) {
      refForm.current?.reset();
      setLibelle("");
    }
  }, [etat]);

  if (!ouvert) {
    return (
      <div className="mb-5 flex flex-col gap-2">
        <div>
          <Bouton ton="principal" icone={Plus} type="button" onClick={() => setOuvert(true)}>
            Nouvelle catégorie
          </Bouton>
        </div>
        <Retour etat={etat} />
      </div>
    );
  }

  return (
    <div className="border-link bg-surface mb-5 rounded-xl border p-5">
      <h3 className="text-heading mb-1 flex items-center gap-2 text-lg font-semibold">
        <Tags aria-hidden size={18} />
        Nouvelle catégorie
      </h3>
      <p className="text-text-3 mb-4 text-sm">
        Exemple : « Comité d&apos;organisation », non proposée au public, mention « COMITÉ
        D&apos;ORGANISATION » sur le badge, zones identiques au personnel de l&apos;ANSD.
      </p>

      <form ref={refForm} action={action} className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
            <label htmlFor="nc-fr" className="text-text-3 text-xs font-semibold">
              Libellé français *
            </label>
            <input
              id="nc-fr"
              name="labelFr"
              required
              value={libelle}
              onChange={(evenement) => setLibelle(evenement.target.value)}
              className={CHAMP}
            />
          </div>
          <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
            <label htmlFor="nc-en" className="text-text-3 text-xs font-semibold">
              Libellé anglais *
            </label>
            <input id="nc-en" name="labelEn" required className={CHAMP} />
          </div>
          <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
            <label htmlFor="nc-pt" className="text-text-3 text-xs font-semibold">
              Libellé portugais
            </label>
            <input id="nc-pt" name="labelPt" className={CHAMP} />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
            <label htmlFor="nc-code" className="text-text-3 text-xs font-semibold">
              Code (figé après la création)
            </label>
            <input
              id="nc-code"
              name="code"
              maxLength={40}
              placeholder={libelle ? codeDeCategorie(libelle) : "Tiré du libellé"}
              className={`${CHAMP} font-mono uppercase`}
            />
          </div>
          <div className="flex w-[92px] flex-col gap-1.5">
            <label htmlFor="nc-couleur" className="text-text-3 text-xs font-semibold">
              Couleur
            </label>
            <input
              id="nc-couleur"
              name="color"
              type="color"
              defaultValue="#6d4c9f"
              className="border-border h-10 w-full cursor-pointer rounded-lg border"
            />
          </div>
          <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
            <label htmlFor="nc-mention" className="text-text-3 text-xs font-semibold">
              Mention sur le badge
            </label>
            <input
              id="nc-mention"
              name="badgeMention"
              maxLength={30}
              placeholder="ex. COMITÉ D'ORGANISATION"
              className={CHAMP}
            />
          </div>
          <div className="flex min-w-[240px] flex-1 flex-col gap-1.5">
            <label htmlFor="nc-zones" className="text-text-3 text-xs font-semibold">
              Zones d&apos;accès au départ
            </label>
            <select id="nc-zones" name="zonesDepuis" defaultValue="TOUTES" className={CHAMP}>
              <option value="TOUTES">Toutes les zones</option>
              {categories.map((categorie) => (
                <option key={categorie.id} value={categorie.id}>
                  Comme « {categorie.labelFr} »
                </option>
              ))}
              <option value="AUCUNE">Aucune (à régler sous Zones d&apos;accès)</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <Case nom="isPublic" coche>
            Proposée au public
          </Case>
          <Case nom="autoConfirm">Validation automatique</Case>
          <Case nom="requiresLogistics">Logistique à prévoir</Case>
          <Case nom="alertOnScan">Scan orange (à accueillir)</Case>
          <Case nom="requiresAccreditation">Accréditation requise (presse)</Case>
        </div>

        <p className="text-text-3 text-xs">
          La mention s&apos;imprime en bande pleine, à la couleur de la catégorie, sous
          l&apos;en-tête du badge. Les badges déjà générés d&apos;un participant changé de catégorie
          sont refaits, avec le même QR.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Bouton ton="principal" icone={Plus} type="submit" disabled={enCours}>
            {enCours ? "Création…" : "Créer la catégorie"}
          </Bouton>
          <Bouton type="button" ton="discret" onClick={() => setOuvert(false)}>
            Fermer
          </Bouton>
        </div>
        <Retour etat={etat} />
      </form>
    </div>
  );
}
