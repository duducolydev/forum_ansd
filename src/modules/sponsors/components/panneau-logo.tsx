"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { auClicConfirme } from "@/components/ui/confirmer";
import { retirerSponsorAction, televerserLogoAction, type EtatAction } from "../actions";
import { LOGO_MAX_BYTES } from "../constantes";
import { AlertCircle, CircleCheck, Upload, X } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { urlVersionnee } from "@/lib/url-fichier";

const etatInitial: EtatAction = {};

export function PanneauLogo({
  sponsorId,
  cheminLogo,
  nom,
}: {
  sponsorId: string;
  /** Chemin de stockage, vide s'il n'y a pas de logo. Sert aussi à versionner l'URL. */
  cheminLogo: string;
  nom: string;
}) {
  const aUnLogo = cheminLogo.length > 0;
  const [etatLogo, actionLogo, logoEnCours] = useActionState(
    televerserLogoAction.bind(null, sponsorId),
    etatInitial,
  );
  const formulaire = useRef<HTMLFormElement>(null);
  const champ = useRef<HTMLInputElement>(null);

  /*
   * Le champ est vidé après un envoi réussi. Sans cela, le nom du fichier reste
   * affiché à côté d'un aperçu déjà à jour, ce qui laisse croire qu'il reste
   * quelque chose à envoyer.
   */
  useEffect(() => {
    if (etatLogo.avis && champ.current) champ.current.value = "";
  }, [etatLogo.avis]);

  const [erreurRetrait, setErreurRetrait] = useState<string | null>(null);
  const [retraitEnCours, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="border-border bg-surface rounded-xl border p-5">
      <h3 className="text-heading mb-3 text-sm font-semibold">Logo</h3>

      {aUnLogo ? (
        /* eslint-disable-next-line @next/next/no-img-element -- servi par une route contrôlée, hors optimiseur */
        <img
          src={urlVersionnee(`/api/v1/sponsors/${sponsorId}/logo`, cheminLogo)}
          alt={`Logo de ${nom}`}
          className="border-border bg-bg mb-3 max-h-24 rounded-lg border p-2"
        />
      ) : (
        <p className="text-text-3 mb-3 text-sm">Aucun logo. Le nom sera affiché à la place.</p>
      )}

      {/*
       * Le fichier part **dès qu'il est choisi**.
       *
       * Le défaut fermé ici a coûté deux allers-retours à l'utilisateur. La
       * fiche porte deux formulaires côte à côte : celui du sponsor, avec son
       * bouton « Enregistrer » bien visible en bas, et celui du logo, avec son
       * propre bouton dans le panneau latéral. Choisir un fichier puis cliquer
       * sur « Enregistrer » — le geste naturel — soumettait le premier
       * formulaire et laissait le fichier sur place. L'écran répondait
       * « Sponsor enregistré », le logo n'était jamais parti, et au
       * rafraîchissement le champ redevenait vide.
       *
       * Choisir un fichier **est** l'intention de l'envoyer : il n'y a donc
       * plus de second geste à ne pas oublier. Le bouton reste, pour réessayer
       * et pour le cas sans JavaScript, mais il n'est plus le seul chemin.
       */}
      <form ref={formulaire} action={actionLogo} className="flex flex-col gap-2">
        <input
          ref={champ}
          type="file"
          name="logo"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          required
          aria-label="Fichier du logo"
          className="text-text-2 text-sm"
          onChange={(evenement) => {
            if (evenement.currentTarget.files?.length)
              evenement.currentTarget.form?.requestSubmit();
          }}
        />
        <p className="text-text-3 text-xs">
          SVG, PNG, JPEG ou WebP, {LOGO_MAX_BYTES / 1024 / 1024} Mo maximum. L&apos;envoi part dès
          que le fichier est choisi. Le SVG donne le meilleur rendu : il reste net à toutes les
          tailles.
        </p>
        <div>
          <Bouton ton="secondaire" icone={Upload} type="submit" disabled={logoEnCours}>
            {logoEnCours ? "Envoi…" : "Téléverser"}
          </Bouton>
        </div>
      </form>
      {/*
       * Le retour de l'action est encadré et porte une icône.
       *
       * Il était rendu en texte nu sous le bouton, dans un panneau étroit et
       * juste au-dessus de « Retirer ce sponsor » : un refus de format passait
       * inaperçu, et l'agent concluait que le dépôt n'avait rien fait. C'est
       * exactement ce qui s'est produit sur le logo de la Banque mondiale.
       *
       * `role="status"` fait annoncer le message par les lecteurs d'écran sans
       * voler le focus.
       */}
      {etatLogo.erreur && (
        <p
          role="status"
          className="border-danger-text bg-danger-soft text-danger-text mt-3 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm"
        >
          <AlertCircle aria-hidden size={15} className="mt-0.5 shrink-0" />
          {etatLogo.erreur}
        </p>
      )}
      {etatLogo.avis && (
        <p
          role="status"
          className="border-accent-text bg-accent-soft text-accent-text mt-3 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm"
        >
          <CircleCheck aria-hidden size={15} className="mt-0.5 shrink-0" />
          {etatLogo.avis}
        </p>
      )}

      <div className="border-border mt-4 border-t pt-4">
        <Bouton
          ton="danger"
          icone={X}
          type="button"
          disabled={retraitEnCours}
          onClick={auClicConfirme(
            {
              titre: "Retirer ce partenaire ?",
              texte: `« ${nom} » disparaîtra du site public. La fiche est conservée en base et reste consultable dans le journal d'audit.`,
              confirmer: "Retirer",
              ton: "danger",
            },
            () => {
              setErreurRetrait(null);
              startTransition(async () => {
                const resultat = await retirerSponsorAction(sponsorId);
                if (resultat.erreur) setErreurRetrait(resultat.erreur);
                else router.refresh();
              });
            },
          )}
        >
          {retraitEnCours ? "Retrait…" : "Retirer ce sponsor"}
        </Bouton>
        {erreurRetrait && <p className="text-danger-text mt-2 text-sm">{erreurRetrait}</p>}
      </div>
    </div>
  );
}
