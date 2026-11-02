"use client";
import { Save } from "lucide-react";
import { BoutonSite } from "@/components/site/bouton-site";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { lireLangue, selon } from "@/lib/langue";
import { confirmer } from "@/components/ui/confirmer";
import { PhotoField } from "./photo-field";
import { removeMyPhotoAction, updateMyPhotoAction, type MySpaceState } from "../my-space-actions";

/**
 * Photo de profil dans l'espace participant.
 *
 * L'action est appelée directement avec un `FormData` construit ici, sans
 * passer par `<form action={…}>` : c'est un fichier, et la sérialisation
 * automatique de React a déjà perdu des valeurs sur ce projet (cf. T32).
 */
export function PhotoForm({
  participantId,
  photoEnregistree,
}: {
  participantId: string;
  photoEnregistree: boolean;
}) {
  const router = useRouter();
  const [fichier, setFichier] = useState<File | null>(null);
  const [etat, setEtat] = useState<MySpaceState>({});
  const [enCours, demarrer] = useTransition();
  const langue = lireLangue(useLocale());
  const t = (textes: { fr: string; en: string; pt: string }) => selon(langue, textes);

  function enregistrer() {
    if (!fichier) return;
    const data = new FormData();
    data.set("photo", fichier);

    demarrer(async () => {
      const resultat = await updateMyPhotoAction(data);
      setEtat(resultat);
      if (resultat.success) {
        setFichier(null);
        router.refresh();
      }
    });
  }

  function retirer() {
    void confirmer({
      titre: t({
        fr: "Retirer votre photo ?",
        en: "Remove your photo?",
        pt: "Remover a sua fotografia?",
      }),
      texte: t({
        fr: "Votre badge sera imprimé sans photo, à moins d'en déposer une nouvelle.",
        en: "Your badge will be printed without a photo unless you upload a new one.",
        pt: "O seu crachá será impresso sem fotografia, a menos que carregue uma nova.",
      }),
      confirmer: t({ fr: "Retirer la photo", en: "Remove photo", pt: "Remover a fotografia" }),
      annuler: t({ fr: "Garder la photo", en: "Keep photo", pt: "Manter a fotografia" }),
      ton: "danger",
    }).then((accepte) => {
      if (!accepte) return;
      demarrer(async () => {
        setEtat(await removeMyPhotoAction());
        router.refresh();
      });
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <PhotoField
        // L'URL porte un paramètre changeant : la route interdit la mise en
        // cache, mais certains navigateurs conservent malgré tout l'ancienne
        // image après un remplacement.
        photoActuelleUrl={
          photoEnregistree ? `/api/v1/participants/${participantId}/photo?v=${Date.now()}` : null
        }
        onChange={setFichier}
        onRemove={photoEnregistree ? retirer : undefined}
        langue={langue}
        label={t({ fr: "Photo de badge", en: "Badge photo", pt: "Fotografia do crachá" })}
        hint={t({
          fr: "Facultative, mais elle facilite le contrôle à l'entrée du Forum.",
          en: "Optional, but it makes the entrance check at the Forum easier.",
          pt: "Facultativa, mas facilita o controlo à entrada do Fórum.",
        })}
      />

      {fichier && (
        <BoutonSite
          type="button"
          onClick={enregistrer}
          disabled={enCours}
          ton="principal"
          taille="compact"
          icone={Save}
          className="w-fit"
        >
          {enCours
            ? t({ fr: "Enregistrement…", en: "Saving…", pt: "A guardar…" })
            : t({ fr: "Enregistrer la photo", en: "Save photo", pt: "Guardar a fotografia" })}
        </BoutonSite>
      )}

      {etat.error && <p className="text-danger-text text-sm">{etat.error}</p>}
      {etat.success && <p className="text-accent-text text-sm">{etat.success}</p>}
    </div>
  );
}
