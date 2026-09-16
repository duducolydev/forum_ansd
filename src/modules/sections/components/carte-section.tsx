"use client";

import { useRouter } from "next/navigation";
import { useActionState, useRef, useState, useTransition, type ChangeEvent } from "react";
import { auClicConfirme } from "@/components/ui/confirmer";
import {
  deplacerSectionAction,
  enregistrerSectionAction,
  supprimerSectionAction,
  type EtatAction,
} from "../actions";
import type { BoutonSection, ChampContenu, TypeSection } from "../catalogue";
import { Save, Trash2 } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { reduirePourEnvoi, tailleLisible } from "@/lib/redimensionner-image";
import { urlVersionnee } from "@/lib/url-fichier";
import { IMAGE_SECTION_MAX_BYTES } from "../constantes";
import { EditeurTexteRiche } from "./editeur-texte-riche";

const etatInitial: EtatAction = {};
const CHAMP = "border-border bg-bg text-text rounded-lg border px-3 py-2.5 text-sm";
const ETIQUETTE = "text-text-3 text-xs font-semibold";

export interface SectionAffichee {
  id: string;
  type: string;
  variant: string;
  isVisible: boolean;
  contentFr: Record<string, string>;
  contentEn: Record<string, string>;
  settings: Record<string, unknown>;
  premiere: boolean;
  derniere: boolean;
}

function ChampsBoutons({
  nom,
  max,
  boutons,
}: {
  nom: string;
  max: number;
  boutons: BoutonSection[];
}) {
  // Une ligne vide de plus : ajouter un bouton ne demande pas de chercher où.
  const lignes = [...boutons];
  if (lignes.length < max) {
    lignes.push({ href: "", labelFr: "", labelEn: "", style: "secondaire" });
  }

  return (
    <fieldset className="border-border mt-3 rounded-lg border p-3">
      <legend className={`${ETIQUETTE} px-1`}>
        {nom} — vider l&apos;adresse et le libellé retire la ligne
      </legend>
      <div className="flex flex-col gap-2">
        {lignes.map((bouton, index) => (
          <div key={index} className="flex flex-wrap gap-2">
            <input
              name={`bouton-href-${index}`}
              defaultValue={bouton.href}
              placeholder="/inscription ou https://…"
              aria-label={`Adresse du bouton ${index + 1}`}
              className={`${CHAMP} min-w-[180px] flex-1`}
            />
            <input
              name={`bouton-fr-${index}`}
              defaultValue={bouton.labelFr}
              placeholder="Libellé (fr)"
              aria-label={`Libellé français du bouton ${index + 1}`}
              className={`${CHAMP} min-w-[130px] flex-1`}
            />
            <input
              name={`bouton-en-${index}`}
              defaultValue={bouton.labelEn}
              placeholder="Label (en)"
              aria-label={`Libellé anglais du bouton ${index + 1}`}
              className={`${CHAMP} min-w-[130px] flex-1`}
            />
            <select
              name={`bouton-style-${index}`}
              defaultValue={bouton.style}
              aria-label={`Style du bouton ${index + 1}`}
              className={CHAMP}
            >
              <option value="principal">Mis en avant</option>
              <option value="secondaire">Secondaire</option>
            </select>
          </div>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Illustration d'une section.
 *
 * Le champ de fichier est **dans le formulaire de la section** : il part au
 * même « Enregistrer » que le reste, et il n'y a donc pas de second bouton à
 * ne pas oublier. C'est la leçon du logo de partenaire, où deux formulaires
 * côte à côte faisaient perdre le fichier sans que rien ne le signale.
 *
 * L'image est **réduite dans le navigateur avant l'envoi**. Sans cela, une
 * photographie d'appareil — 4 à 8 Mo couramment — dépassait la limite de 3 Mo
 * des Server Actions, était rejetée par la plateforme avant tout code
 * applicatif, et l'écran ne bougeait pas : ni image, ni message. Voir
 * `reduirePourEnvoi`.
 *
 * L'aperçu est servi par une route contrôlée et non par un `blob:` local :
 * ce qui est montré est ce qui est réellement enregistré.
 */
function ChampIllustration({
  sectionId,
  cle,
  label,
  aide,
  chemin,
  limiteOctets,
}: {
  sectionId: string;
  cle: string;
  label: string;
  aide?: string;
  chemin: string;
  limiteOctets: number;
}) {
  const champ = useRef<HTMLInputElement>(null);
  const [etat, setEtat] = useState<{ ton: "info" | "erreur"; texte: string } | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [fichierChoisi, setFichierChoisi] = useState(false);

  async function auChoix(evenement: ChangeEvent<HTMLInputElement>) {
    const fichier = evenement.currentTarget.files?.[0];
    if (!fichier) {
      setEtat(null);
      setFichierChoisi(false);
      return;
    }

    setEnCours(true);
    setEtat(null);
    try {
      const resultat = await reduirePourEnvoi(fichier, limiteOctets);

      if (!resultat) {
        /*
         * Refus **devant l'agent**, avant tout envoi. C'est le seul moment où
         * l'on peut encore lui dire quelque chose d'utile : passé la limite de
         * la plateforme, la requête n'atteint aucun code applicatif.
         */
        setEtat({
          ton: "erreur",
          texte: `Image trop lourde même après réduction (${tailleLisible(fichier.size)}). Essayez une image moins grande ou un JPEG.`,
        });
        if (champ.current) champ.current.value = "";
        setFichierChoisi(false);
        return;
      }

      if (resultat.reduite && champ.current) {
        // Le fichier réduit remplace l'original dans le champ, pour que ce soit
        // lui qui parte au moment de l'enregistrement.
        const transfert = new DataTransfer();
        transfert.items.add(resultat.fichier);
        champ.current.files = transfert.files;
      }

      setFichierChoisi(true);
      setEtat({
        ton: "info",
        texte: resultat.reduite
          ? `Prête : ${tailleLisible(fichier.size)} réduits à ${tailleLisible(resultat.fichier.size)}. Enregistrez la section.`
          : `Prête : ${tailleLisible(resultat.fichier.size)}. Enregistrez la section.`,
      });
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="border-border mt-4 flex flex-col gap-2 rounded-lg border p-3">
      <span className={ETIQUETTE}>{label}</span>

      {chemin ? (
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- servie par une route contrôlée, hors optimiseur */}
          <img
            src={urlVersionnee(`/api/v1/sections/${sectionId}/image`, chemin)}
            alt=""
            className="border-border bg-bg max-h-20 rounded-md border object-contain p-1"
          />
          {/*
           * La case est neutralisée dès qu'un fichier est choisi : « remplacer »
           * et « retirer » sont deux ordres contradictoires, et les laisser
           * cochés ensemble oblige à deviner lequel l'emporte.
           */}
          <label
            htmlFor={`${sectionId}-retirer-${cle}`}
            className={`flex items-center gap-2 text-sm ${
              fichierChoisi ? "text-text-3 opacity-60" : "text-text-2"
            }`}
          >
            <input
              id={`${sectionId}-retirer-${cle}`}
              type="checkbox"
              name={`retirer-${cle}`}
              disabled={fichierChoisi}
            />
            {fichierChoisi ? "Remplacée par le fichier choisi" : "Retirer à l'enregistrement"}
          </label>
        </div>
      ) : (
        <span className="text-text-3 text-sm">Aucune illustration.</span>
      )}

      <input
        ref={champ}
        type="file"
        name={`fichier-${cle}`}
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        aria-label={`${label} : choisir un fichier`}
        onChange={(evenement) => void auChoix(evenement)}
        className="text-text-2 text-sm"
      />

      {enCours && <span className="text-text-3 text-xs">Préparation de l&apos;image…</span>}
      {etat && (
        <span
          role="status"
          className={`text-xs ${etat.ton === "erreur" ? "text-danger-text" : "text-accent-text"}`}
        >
          {etat.texte}
        </span>
      )}
      {aide && <span className="text-text-3 text-xs">{aide}</span>}
    </div>
  );
}

/**
 * Un champ de contenu, dans une langue.
 *
 * Le texte mis en forme passe par l'éditeur, dont la zone d'édition n'est pas un
 * champ de formulaire : elle est nommée par l'étiquette visible, via
 * `aria-labelledby`, ce qui la rend trouvable au clavier, à la synthèse vocale
 * et par les tests, sous le même libellé qu'avant.
 */
function ChampLangue({
  sectionId,
  champ,
  langue,
  valeur,
}: {
  sectionId: string;
  champ: ChampContenu;
  langue: "fr" | "en";
  valeur: string;
}) {
  const id = `${langue}-${sectionId}-${champ.cle}`;
  const libelle =
    langue === "fr" ? `${champ.label} (français)` : `${champ.label} (anglais — repli FR si vide)`;

  if (champ.type === "riche") {
    return (
      <div className="flex flex-col gap-1.5">
        <span id={`etiquette-${id}`} className={ETIQUETTE}>
          {libelle}
        </span>
        <EditeurTexteRiche
          id={id}
          name={`${langue}-${champ.cle}`}
          labelId={`etiquette-${id}`}
          libelle={libelle}
          valeurInitiale={valeur}
          max={champ.max}
        />
        {langue === "fr" && champ.aide && <span className="text-text-3 text-xs">{champ.aide}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={ETIQUETTE}>
        {libelle}
      </label>
      {champ.type === "long" ? (
        <textarea
          id={id}
          name={`${langue}-${champ.cle}`}
          rows={3}
          maxLength={champ.max}
          defaultValue={valeur}
          className={CHAMP}
        />
      ) : (
        <input
          id={id}
          name={`${langue}-${champ.cle}`}
          maxLength={champ.max}
          defaultValue={valeur}
          className={CHAMP}
        />
      )}
      {langue === "fr" && champ.aide && <span className="text-text-3 text-xs">{champ.aide}</span>}
    </div>
  );
}

export function CarteSection({
  section,
  modele,
}: {
  section: SectionAffichee;
  modele: TypeSection;
}) {
  const [etat, action, enCours] = useActionState(
    enregistrerSectionAction.bind(null, section.id),
    etatInitial,
  );
  const [erreur, setErreur] = useState<string | null>(null);
  const [enAction, startTransition] = useTransition();
  const router = useRouter();

  function lancer(operation: () => Promise<EtatAction>) {
    setErreur(null);
    startTransition(async () => {
      const resultat = await operation();
      if (resultat.erreur) setErreur(resultat.erreur);
      else router.refresh();
    });
  }

  return (
    /* `data-id` est exposé pour que les tests nettoient ce qu'ils créent sans
       avoir à deviner la bonne carte au texte qu'elle contient. */
    <div
      data-testid="carte-section"
      data-type={section.type}
      data-id={section.id}
      className="border-border bg-surface rounded-xl border p-5"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-heading text-sm font-semibold">{modele.label}</span>
        {section.isVisible ? (
          <span className="bg-accent-soft text-accent-text rounded-md px-2 py-0.5 text-xs font-semibold">
            Affichée
          </span>
        ) : (
          <span className="bg-bg-3 text-text-2 rounded-md px-2 py-0.5 text-xs font-semibold">
            Masquée
          </span>
        )}
        <span className="flex-1" />
        <button
          type="button"
          disabled={enAction || section.premiere}
          onClick={() => lancer(() => deplacerSectionAction(section.id, "haut"))}
          className="border-border text-heading rounded-lg border px-2.5 py-1 text-sm disabled:opacity-40"
          aria-label={`Monter la section ${modele.label}`}
        >
          ↑
        </button>
        <button
          type="button"
          disabled={enAction || section.derniere}
          onClick={() => lancer(() => deplacerSectionAction(section.id, "bas"))}
          className="border-border text-heading rounded-lg border px-2.5 py-1 text-sm disabled:opacity-40"
          aria-label={`Descendre la section ${modele.label}`}
        >
          ↓
        </button>
        <Bouton
          ton="danger"
          icone={Trash2}
          type="button"
          disabled={enAction}
          onClick={auClicConfirme(
            {
              titre: "Supprimer cette section ?",
              texte: `« ${modele.label} » disparaîtra de la page, avec ses textes et ses réglages.`,
              confirmer: "Supprimer",
              ton: "danger",
            },
            () => lancer(() => supprimerSectionAction(section.id)),
          )}
        >
          Supprimer
        </Bouton>
      </div>

      <p className="text-text-3 mb-3 text-xs">{modele.description}</p>

      <form action={action}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[200px] flex-col gap-1.5">
            <label htmlFor={`variant-${section.id}`} className={ETIQUETTE}>
              Présentation
            </label>
            <select
              id={`variant-${section.id}`}
              name="variant"
              defaultValue={section.variant}
              className={CHAMP}
            >
              {modele.variantes.map((variante) => (
                <option key={variante.cle} value={variante.cle}>
                  {variante.label}
                </option>
              ))}
            </select>
          </div>
          <label className="text-text-2 flex items-center gap-2 py-2.5 text-sm">
            <input type="checkbox" name="isVisible" defaultChecked={section.isVisible} />
            Afficher sur le site
          </label>
        </div>

        {modele.champs.length > 0 && (
          <div className="mt-3 grid grid-cols-1 gap-3.5 md:grid-cols-2">
            {modele.champs.map((champ) => (
              <div key={champ.cle} className="contents">
                <ChampLangue
                  sectionId={section.id}
                  champ={champ}
                  langue="fr"
                  valeur={section.contentFr[champ.cle] ?? ""}
                />
                <ChampLangue
                  sectionId={section.id}
                  champ={champ}
                  langue="en"
                  valeur={section.contentEn[champ.cle] ?? ""}
                />
              </div>
            ))}
          </div>
        )}

        {modele.reglages.map((champ) => {
          if (champ.type === "boutons") {
            return (
              <ChampsBoutons
                key={champ.cle}
                nom={champ.label}
                max={champ.max}
                boutons={(section.settings[champ.cle] as BoutonSection[] | undefined) ?? []}
              />
            );
          }
          if (champ.type === "booleen") {
            return (
              <label
                key={champ.cle}
                htmlFor={`${section.id}-${champ.cle}`}
                className="text-text-2 mt-2 flex items-center gap-2 text-sm"
              >
                <input
                  id={`${section.id}-${champ.cle}`}
                  type="checkbox"
                  name={champ.cle}
                  defaultChecked={
                    typeof section.settings[champ.cle] === "boolean"
                      ? (section.settings[champ.cle] as boolean)
                      : champ.defaut
                  }
                />
                {champ.label}
              </label>
            );
          }
          if (champ.type === "ancre") {
            return (
              <div key={champ.cle} className="mt-3 flex w-[260px] flex-col gap-1.5">
                <label htmlFor={`${section.id}-${champ.cle}`} className={ETIQUETTE}>
                  {champ.label}
                </label>
                <input
                  id={`${section.id}-${champ.cle}`}
                  type="text"
                  name={champ.cle}
                  defaultValue={String(section.settings[champ.cle] ?? "")}
                  placeholder="a-propos"
                  className={CHAMP}
                />
                {champ.aide && <span className="text-text-3 text-xs">{champ.aide}</span>}
              </div>
            );
          }
          if (champ.type === "image") {
            return (
              <ChampIllustration
                key={champ.cle}
                sectionId={section.id}
                cle={champ.cle}
                label={champ.label}
                aide={champ.aide}
                chemin={String(section.settings[champ.cle] ?? "")}
                limiteOctets={IMAGE_SECTION_MAX_BYTES}
              />
            );
          }
          if (champ.type === "choix") {
            const courant = String(section.settings[champ.cle] ?? champ.defaut);
            return (
              <fieldset key={champ.cle} className="mt-3 flex flex-col gap-1.5">
                <legend className={ETIQUETTE}>{champ.label}</legend>
                <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                  {champ.options.map((option) => (
                    <label
                      key={option.cle}
                      htmlFor={`${section.id}-${champ.cle}-${option.cle}`}
                      className="text-text-2 flex items-center gap-2 text-sm"
                    >
                      <input
                        id={`${section.id}-${champ.cle}-${option.cle}`}
                        type="radio"
                        name={champ.cle}
                        value={option.cle}
                        defaultChecked={courant === option.cle}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
                {champ.aide && <span className="text-text-3 text-xs">{champ.aide}</span>}
              </fieldset>
            );
          }
          return (
            <div key={champ.cle} className="mt-3 flex w-[190px] flex-col gap-1.5">
              <label htmlFor={`${section.id}-${champ.cle}`} className={ETIQUETTE}>
                {champ.label}
              </label>
              <input
                id={`${section.id}-${champ.cle}`}
                type="number"
                name={champ.cle}
                min={champ.min}
                max={champ.max}
                defaultValue={Number(section.settings[champ.cle] ?? champ.defaut)}
                className={CHAMP}
              />
            </div>
          );
        })}

        <Bouton ton="principal" icone={Save} type="submit" disabled={enCours} className="mt-4">
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </Bouton>
        {etat.erreur && <p className="text-danger-text mt-2 text-sm">{etat.erreur}</p>}
        {etat.avis && <p className="text-accent-text mt-2 text-sm">{etat.avis}</p>}
      </form>

      {erreur && <p className="text-danger-text mt-2 text-sm">{erreur}</p>}
    </div>
  );
}
