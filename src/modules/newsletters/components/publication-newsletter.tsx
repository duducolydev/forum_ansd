"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, Globe, Send, Trash2 } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { auClicConfirme } from "@/components/ui/confirmer";
import type { BoiteEnvoi } from "@/lib/mail";
import {
  apercuEnvoiAction,
  depublierAction,
  publierEtEnvoyerAction,
  publierSansEnvoyerAction,
  supprimerNewsletterAction,
} from "../actions";
import type { Lot } from "../repartition";

export interface BoiteProposee {
  boite: BoiteEnvoi;
  libelle: string;
  sert: string;
  adresse: string;
  quota: number;
  plafond: number;
  dejaUtilise: number;
  partageAvec: BoiteEnvoi | null;
}

interface Apercu {
  destinataires: number;
  lots: Lot[];
  jours: number;
  doublons: BoiteEnvoi[];
  erreur?: string;
}

const jourCourt = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Dakar",
});

function libelleJour(lot: Lot): string {
  const quand = jourCourt.format(new Date(lot.debut));
  return lot.jour === 0 ? `Dès maintenant (${quand})` : `Jour ${lot.jour + 1} — ${quand}`;
}

/** Plan d'envoi : une ligne par boîte et par jour. */
export function TablePlan({ lots, libelles }: { lots: Lot[]; libelles: Record<string, string> }) {
  if (lots.length === 0) return null;
  return (
    <div className="border-border overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-border text-text-3 border-b text-left text-xs">
            <th className="px-3 py-2 font-semibold">Départ</th>
            <th className="px-3 py-2 font-semibold">Boîte</th>
            <th className="px-3 py-2 font-semibold">Adresse</th>
            <th className="px-3 py-2 text-right font-semibold">Messages</th>
          </tr>
        </thead>
        <tbody>
          {lots.map((lot) => (
            <tr key={`${lot.jour}-${lot.cle}`} className="border-border border-b last:border-0">
              <td className="px-3 py-2">{libelleJour(lot)}</td>
              <td className="px-3 py-2">{libelles[lot.boite] ?? lot.boite}</td>
              <td className="text-text-2 px-3 py-2">{lot.adresse}</td>
              <td className="px-3 py-2 text-right tabular-nums">{lot.nombre}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Publication et envoi d'une newsletter (25 novembre 2026).
 *
 * L'annonce aux participants part **avec la publication**, d'un seul bouton
 * qui dit sa portée et demande confirmation. « Publier sans envoyer » reste
 * possible, l'envoi se faisant alors plus tard depuis ce même panneau.
 *
 * L'aperçu se recalcule à chaque changement de ciblage : combien de
 * participants, et quelle boîte envoie combien, quel jour. Une boîte repliée
 * sur le compte d'une autre est signalée — la cocher en plus n'ajoute aucune
 * capacité.
 */
export function PublicationNewsletter({
  id,
  titre,
  publiee,
  aUnFichier,
  categories,
  statuts,
  boites,
}: {
  id: string;
  titre: string;
  publiee: boolean;
  aUnFichier: boolean;
  categories: { id: string; libelle: string; effectif: number }[];
  statuts: { valeur: string; libelle: string }[];
  boites: BoiteProposee[];
}) {
  const router = useRouter();
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [choixStatuts, setChoixStatuts] = useState<string[]>(statuts.map((s) => s.valeur));
  // Par défaut : les boîtes à compte propre, hors transactionnelle — celle des
  // codes du BackOffice, qu'une newsletter ne doit pas assécher.
  const [choixBoites, setChoixBoites] = useState<BoiteEnvoi[]>(
    boites.filter((b) => b.boite !== "transactionnel" && !b.partageAvec).map((b) => b.boite),
  );
  const [apercu, setApercu] = useState<Apercu | null>(null);
  const [message, setMessage] = useState<{ texte: string; erreur: boolean } | null>(null);
  const [enCours, startTransition] = useTransition();
  const [calcul, startCalcul] = useTransition();

  const ciblage = useMemo(
    () => ({ categoryIds, statuts: choixStatuts, boites: choixBoites }),
    [categoryIds, choixStatuts, choixBoites],
  );
  const libelles = Object.fromEntries(boites.map((b) => [b.boite, b.libelle]));

  useEffect(() => {
    if (choixStatuts.length === 0 || choixBoites.length === 0) {
      setApercu(null);
      return;
    }
    const minuterie = setTimeout(() => {
      startCalcul(async () => {
        const resultat = await apercuEnvoiAction(id, ciblage);
        setApercu(
          "destinataires" in resultat
            ? resultat
            : { destinataires: 0, lots: [], jours: 0, doublons: [], erreur: resultat.erreur },
        );
      });
    }, 300);
    return () => clearTimeout(minuterie);
  }, [id, ciblage, choixStatuts.length, choixBoites.length]);

  function basculer<T>(liste: T[], valeur: T, coche: boolean): T[] {
    return coche ? [...liste, valeur] : liste.filter((v) => v !== valeur);
  }

  const nombre = apercu?.destinataires ?? 0;
  const bloque =
    enCours ||
    calcul ||
    !aUnFichier ||
    !apercu ||
    Boolean(apercu.erreur) ||
    nombre === 0 ||
    choixStatuts.length === 0 ||
    choixBoites.length === 0;

  function lancer(action: () => Promise<{ erreur?: string; avis?: string }>) {
    startTransition(async () => {
      const resultat = await action();
      setMessage(
        resultat.erreur
          ? { texte: resultat.erreur, erreur: true }
          : { texte: resultat.avis ?? "C'est fait.", erreur: false },
      );
      router.refresh();
    });
  }

  const libelleEnvoi = `${publiee ? "Envoyer" : "Publier et envoyer"} à ${nombre} participant${nombre > 1 ? "s" : ""}`;
  const etalement =
    apercu && apercu.jours > 1
      ? ` L'envoi s'étalera sur ${apercu.jours} jours pour tenir les quotas des boîtes.`
      : "";

  return (
    <div className="flex flex-col gap-5">
      <div className="border-border bg-surface flex flex-col gap-4 rounded-xl border p-6">
        <div>
          <h3 className="mb-1 text-lg">
            {publiee ? "Envoyer aux participants" : "Publier et envoyer"}
          </h3>
          <p className="text-text-2 text-sm">
            La newsletter est mise en ligne sur le portail, et un courriel l&apos;annonce aux
            participants visés, avec le lien de téléchargement du fichier. L&apos;envoi ne se fait
            qu&apos;une fois.
          </p>
        </div>

        {!aUnFichier && (
          <p className="text-warn-text bg-warn-soft rounded-lg px-3 py-2.5 text-sm">
            Aucun fichier PDF : déposez-le dans le formulaire ci-dessus avant de publier.
          </p>
        )}

        <fieldset className="flex flex-col gap-2">
          <legend className="text-heading mb-1 text-sm font-semibold">
            Catégories de participants
          </legend>
          <span className="text-text-3 text-xs">Aucune cochée : toutes les catégories.</span>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {categories.map((categorie) => (
              <label key={categorie.id} className="text-text-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={categoryIds.includes(categorie.id)}
                  onChange={(e) =>
                    setCategoryIds((avant) => basculer(avant, categorie.id, e.target.checked))
                  }
                />
                {categorie.libelle}
                <span className="text-text-3 text-xs">({categorie.effectif})</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-heading mb-1 text-sm font-semibold">Statuts</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {statuts.map((statut) => (
              <label key={statut.valeur} className="text-text-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={choixStatuts.includes(statut.valeur)}
                  onChange={(e) =>
                    setChoixStatuts((avant) => basculer(avant, statut.valeur, e.target.checked))
                  }
                />
                {statut.libelle}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-heading mb-1 text-sm font-semibold">Boîtes d&apos;envoi</legend>
          <span className="text-text-3 text-xs">
            Les participants sont répartis entre les boîtes cochées, chacune dans la limite de son
            quota du jour ; le surplus part les jours suivants. 20 % de chaque quota restent
            réservés aux autres courriels (connexions, badges, confirmations).
          </span>
          <div className="flex flex-col gap-2">
            {boites.map((boite) => (
              <label key={boite.boite} className="text-text-2 flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4"
                  checked={choixBoites.includes(boite.boite)}
                  onChange={(e) =>
                    setChoixBoites((avant) => basculer(avant, boite.boite, e.target.checked))
                  }
                />
                <span>
                  <strong className="text-heading">{boite.libelle}</strong> — {boite.adresse}
                  <span className="text-text-3 block text-xs">
                    {boite.dejaUtilise} / {boite.quota} envois sur 24 h · jusqu&apos;à{" "}
                    {boite.plafond} par jour pour la newsletter · sert aussi : {boite.sert}
                    {boite.partageAvec &&
                      ` · même compte que « ${libelles[boite.partageAvec]} » : pas de capacité en plus`}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2" aria-live="polite">
          {calcul && !apercu && <p className="text-text-3 text-sm">Calcul de l&apos;envoi…</p>}
          {apercu?.erreur && <p className="text-danger-text text-sm">{apercu.erreur}</p>}
          {apercu && !apercu.erreur && (
            <>
              <p className="text-text text-sm">
                <strong>{apercu.destinataires}</strong> participant
                {apercu.destinataires > 1 ? "s" : ""} visé{apercu.destinataires > 1 ? "s" : ""}.
                {etalement}
              </p>
              {apercu.doublons.length > 0 && (
                <p className="text-warn-text text-xs">
                  {apercu.doublons.map((b) => libelles[b]).join(", ")} : même compte qu&apos;une
                  autre boîte cochée, sans effet sur la capacité.
                </p>
              )}
              <TablePlan lots={apercu.lots} libelles={libelles} />
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <Bouton
            ton="principal"
            icone={Send}
            disabled={bloque}
            onClick={auClicConfirme(
              {
                titre: `${publiee ? "Envoyer" : "Publier et envoyer"} « ${titre} » ?`,
                texte: `Le courriel d'annonce partira vers ${nombre} participant(s).${etalement} Les messages partis ne se rappellent pas, et un second envoi ne sera pas possible.`,
                confirmer: publiee ? "Envoyer" : "Publier et envoyer",
                ton: "neutre",
              },
              () => lancer(() => publierEtEnvoyerAction(id, ciblage)),
            )}
          >
            {enCours ? "Envoi…" : libelleEnvoi}
          </Bouton>

          {!publiee ? (
            <Bouton
              ton="discret"
              icone={Globe}
              disabled={enCours || !aUnFichier}
              onClick={auClicConfirme(
                {
                  titre: `Publier « ${titre} » sans l'envoyer ?`,
                  texte:
                    "La newsletter sera en ligne sur le portail, sans courriel. Vous pourrez l'envoyer plus tard depuis ce panneau.",
                  confirmer: "Publier sans envoyer",
                  ton: "neutre",
                },
                () => lancer(() => publierSansEnvoyerAction(id)),
              )}
            >
              Publier sans envoyer
            </Bouton>
          ) : (
            <Bouton
              ton="discret"
              icone={EyeOff}
              disabled={enCours}
              onClick={auClicConfirme(
                {
                  titre: `Retirer « ${titre} » du portail ?`,
                  texte: "Sa page et son fichier ne seront plus accessibles au public.",
                  confirmer: "Retirer",
                  ton: "danger",
                },
                () => lancer(() => depublierAction(id)),
              )}
            >
              Retirer du portail
            </Bouton>
          )}
        </div>

        {message && (
          <p
            role="status"
            className={`text-sm ${message.erreur ? "text-danger-text" : "text-accent-text"}`}
          >
            {message.texte}
          </p>
        )}
      </div>

      <div className="border-border bg-surface rounded-xl border p-6">
        <h3 className="mb-1 text-lg">Supprimer</h3>
        <p className="text-text-2 mb-3 text-sm">
          Possible tant que la newsletter n&apos;a pas été envoyée. Son fichier est supprimé avec
          elle.
        </p>
        <Bouton
          ton="danger"
          taille="petit"
          icone={Trash2}
          disabled={enCours}
          onClick={auClicConfirme(
            {
              titre: `Supprimer « ${titre} » ?`,
              texte: "La newsletter et son fichier sont supprimés définitivement.",
              confirmer: "Supprimer",
              ton: "danger",
            },
            () =>
              startTransition(async () => {
                const resultat = await supprimerNewsletterAction(id, {});
                if (resultat.erreur) {
                  setMessage({ texte: resultat.erreur, erreur: true });
                  return;
                }
                router.push("/admin/newsletters");
              }),
          )}
        >
          Supprimer cette newsletter
        </Bouton>
      </div>
    </div>
  );
}
