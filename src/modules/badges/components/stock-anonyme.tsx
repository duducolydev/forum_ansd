"use client";

import { useState, useTransition } from "react";
import { IdCard } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { confirmer } from "@/components/ui/confirmer";
import { creerBadgesAnonymesAction } from "../bulk-actions";
import type { StockAnonyme } from "../anonymes";
import { BoutonExportZip } from "./bouton-export-zip";

/**
 * Stock de cartes anonymes : ce qu'il en reste, et de quoi en produire
 * (19 novembre 2026).
 *
 * Ces cartes se préparent **la veille**, pas au comptoir : le jour J, l'accueil
 * n'a que le temps d'en prendre une dans une pile et d'y écrire un nom. L'écran
 * sert donc à constituer le stock et à l'imprimer, pas à produire à l'unité.
 *
 * Le compte restant est affiché par catégorie parce que c'est la seule chose
 * qu'on veut savoir en passant : « combien de cartes protocole me reste-t-il
 * dans la pile ».
 */
export function StockAnonymeBadges({
  stocks,
  categories,
  peutGenerer,
}: {
  stocks: StockAnonyme[];
  categories: { id: string; labelFr: string }[];
  peutGenerer: boolean;
}) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [nombre, setNombre] = useState(20);
  const [enCours, startTransition] = useTransition();
  const [bilan, setBilan] = useState<{ ton: "ok" | "alerte"; texte: string } | null>(null);

  const categorie = categories.find((ligne) => ligne.id === categoryId);

  function creer() {
    if (!categorie) return;
    setBilan(null);
    void confirmer({
      titre: `Créer ${nombre} carte(s) anonyme(s) « ${categorie.labelFr} » ?`,
      texte:
        "Ces cartes ouvrent les mêmes portes que les badges nominatifs. Elles sortent sans nom, " +
        "à remplir à la main à la remise, et leurs numéros se suivent sans jamais être réutilisés.",
      confirmer: `Créer ${nombre} carte(s)`,
      ton: "neutre",
    }).then((accepte) => {
      if (!accepte) return;
      startTransition(async () => {
        const reponse = await creerBadgesAnonymesAction(categoryId, nombre);
        if (reponse.error || reponse.marques === undefined) {
          setBilan({ ton: "alerte", texte: reponse.error ?? "La création a échoué." });
          return;
        }
        const bornes = reponse.references;
        setBilan({
          ton: "ok",
          texte:
            `${reponse.marques} carte(s) créée(s)` +
            (bornes?.length ? ` — de ${bornes[0]} à ${bornes[bornes.length - 1]}` : "") +
            `. Le rendu se poursuit en arrière-plan ; actualisez pour suivre.`,
        });
      });
    });
  }

  return (
    <div className="border-border bg-surface flex flex-col gap-4 rounded-xl border p-4">
      <div>
        <h2 className="text-heading text-base font-semibold">Cartes anonymes</h2>
        <p className="text-text-2 text-sm">
          Le stock de secours du jour J : gardes du corps, protocole, visiteurs de passage. Sans nom
          — l&apos;accueil l&apos;écrit à la main — mais avec un QR valide.
        </p>
      </div>

      {stocks.length === 0 ? (
        <p className="text-text-3 text-sm">Aucune carte anonyme pour l&apos;instant.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {stocks.map((stock) => (
            <li
              key={stock.categoryId}
              className="border-border flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2"
            >
              <span
                aria-hidden
                className="size-3 shrink-0 rounded-full"
                style={{ background: stock.couleur ?? "#9aa3ad" }}
              />
              <span className="text-heading text-sm font-semibold">{stock.categorieLabel}</span>
              <span className="text-text-2 text-sm">
                {stock.total} carte(s) · {stock.pretes} prête(s) à imprimer
              </span>
              <span className="text-text-3 text-xs">dernier n° {stock.dernierNumero}</span>
              <span className="ml-auto">
                <BoutonExportZip
                  href={`/api/v1/badges/anonymes?categoryId=${stock.categoryId}`}
                  libelle="Export ZIP du stock"
                  titre={`Les ${stock.pretes} carte(s) rendues de cette catégorie, numérotées et triées.`}
                />
              </span>
            </li>
          ))}
        </ul>
      )}

      {peutGenerer && categories.length > 0 && (
        <div className="border-border flex flex-wrap items-end gap-3 border-t pt-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="anon-categorie" className="text-text-3 text-xs font-semibold">
              Catégorie
            </label>
            <select
              id="anon-categorie"
              value={categoryId}
              onChange={(evenement) => setCategoryId(evenement.target.value)}
              disabled={enCours}
              className="border-border bg-bg text-text w-52 rounded-lg border px-3 py-2 text-sm"
            >
              {categories.map((ligne) => (
                <option key={ligne.id} value={ligne.id}>
                  {ligne.labelFr}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="anon-nombre" className="text-text-3 text-xs font-semibold">
              Nombre de cartes
            </label>
            <input
              id="anon-nombre"
              type="number"
              min={1}
              max={200}
              value={nombre}
              onChange={(evenement) => setNombre(Number(evenement.target.value))}
              disabled={enCours}
              className="border-border bg-bg text-text w-28 rounded-lg border px-3 py-2 text-sm"
            />
          </div>

          <Bouton
            ton="secondaire"
            icone={IdCard}
            type="button"
            disabled={enCours || !categorie || nombre < 1 || nombre > 200}
            onClick={creer}
          >
            {enCours ? "Création…" : `Créer ${nombre} carte(s) anonyme(s)`}
          </Bouton>
        </div>
      )}

      {bilan && (
        <p
          role="status"
          className={`text-sm ${bilan.ton === "ok" ? "text-accent-text" : "text-warn-text"}`}
        >
          {bilan.texte}
        </p>
      )}
    </div>
  );
}
