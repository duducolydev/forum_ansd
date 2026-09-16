"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { enregistrerCategorieAction, type EtatAction } from "../actions";
import { CHAMP, Retour } from "./champs";

const etatInitial: EtatAction = {};

export interface CategorieAffichee {
  id: string;
  code: string;
  labelFr: string;
  labelEn: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
  autoConfirm: boolean;
  requiresLogistics: boolean;
  alertOnScan: boolean;
  inscrits: number;
}

function Case({
  nom,
  id,
  coche,
  children,
}: {
  nom: string;
  id: string;
  coche: boolean;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={id} className="text-text-2 flex items-center gap-2 text-sm whitespace-nowrap">
      <input id={id} type="checkbox" name={nom} defaultChecked={coche} />
      {children}
    </label>
  );
}

export function LigneCategorie({ categorie }: { categorie: CategorieAffichee }) {
  const [etat, action, enCours] = useActionState(
    enregistrerCategorieAction.bind(null, categorie.id),
    etatInitial,
  );

  return (
    <div className="border-border bg-surface rounded-xl border p-4">
      <div className="mb-3 flex items-center gap-2">
        <span
          aria-hidden
          style={{ background: categorie.color || "transparent" }}
          className="border-border h-4 w-4 shrink-0 rounded border"
        />
        <code className="text-text-3 text-xs">{categorie.code}</code>
        <span className="flex-1" />
        <span className="text-text-3 text-xs">
          {categorie.inscrits} inscrit{categorie.inscrits > 1 ? "s" : ""}
        </span>
      </div>

      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[170px] flex-1 flex-col gap-1.5">
          <label htmlFor={`fr-${categorie.id}`} className="text-text-3 text-xs font-semibold">
            Libellé français
          </label>
          <input
            id={`fr-${categorie.id}`}
            name="labelFr"
            required
            defaultValue={categorie.labelFr}
            className={CHAMP}
          />
        </div>
        <div className="flex min-w-[170px] flex-1 flex-col gap-1.5">
          <label htmlFor={`en-${categorie.id}`} className="text-text-3 text-xs font-semibold">
            Libellé anglais
          </label>
          <input
            id={`en-${categorie.id}`}
            name="labelEn"
            required
            defaultValue={categorie.labelEn}
            className={CHAMP}
          />
        </div>
        <div className="flex w-[92px] flex-col gap-1.5">
          <label htmlFor={`couleur-${categorie.id}`} className="text-text-3 text-xs font-semibold">
            Couleur
          </label>
          <input
            id={`couleur-${categorie.id}`}
            name="color"
            type="color"
            defaultValue={categorie.color || "#0b4f8a"}
            className="border-border h-10 w-full cursor-pointer rounded-lg border"
          />
        </div>
        <div className="flex w-[82px] flex-col gap-1.5">
          <label htmlFor={`ordre-${categorie.id}`} className="text-text-3 text-xs font-semibold">
            Ordre
          </label>
          <input
            id={`ordre-${categorie.id}`}
            name="sortOrder"
            type="number"
            min={0}
            defaultValue={categorie.sortOrder}
            className={CHAMP}
          />
        </div>

        <div className="flex flex-wrap gap-4 py-2.5">
          <Case nom="isActive" id={`actif-${categorie.id}`} coche={categorie.isActive}>
            Proposée à l&apos;inscription
          </Case>
          <Case nom="autoConfirm" id={`auto-${categorie.id}`} coche={categorie.autoConfirm}>
            Validation automatique
          </Case>
          <Case
            nom="requiresLogistics"
            id={`logistique-${categorie.id}`}
            coche={categorie.requiresLogistics}
          >
            Logistique à prévoir
          </Case>
          <Case nom="alertOnScan" id={`alerte-${categorie.id}`} coche={categorie.alertOnScan}>
            Scan orange (à accueillir)
          </Case>
        </div>

        <Bouton ton="principal" icone={Save} type="submit" disabled={enCours}>
          {enCours ? "…" : "Enregistrer"}
        </Bouton>
      </form>
      <Retour etat={etat} />
    </div>
  );
}
