"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { auClicConfirme } from "@/components/ui/confirmer";
import { enregistrerNiveauAction, supprimerNiveauAction, type EtatAction } from "../actions";
import { Plus, Save, Trash2 } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";

const etatInitial: EtatAction = {};
const CHAMP = "border-border bg-bg text-text rounded-lg border px-3 py-2.5 text-sm";

export function LigneNiveau({
  niveau,
  nombreSponsors,
}: {
  niveau?: {
    id: string;
    code: string;
    name: string;
    sortOrder: number;
    logoMaxWidth: number | null;
  };
  nombreSponsors?: number;
}) {
  const [etat, action, enCours] = useActionState(
    enregistrerNiveauAction.bind(null, niveau?.id ?? null),
    etatInitial,
  );
  const [erreurSuppression, setErreurSuppression] = useState<string | null>(null);
  const [suppressionEnCours, startTransition] = useTransition();
  const router = useRouter();

  const prefixe = niveau?.id ?? "nouveau";

  return (
    <div className="border-border bg-surface rounded-xl border p-4">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="flex w-[140px] flex-col gap-1.5">
          <label htmlFor={`code-${prefixe}`} className="text-text-3 text-xs font-semibold">
            Code
          </label>
          <input
            id={`code-${prefixe}`}
            name="code"
            required
            defaultValue={niveau?.code ?? ""}
            placeholder="GOLD"
            className={`${CHAMP} font-mono uppercase`}
          />
        </div>
        <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
          <label htmlFor={`nom-${prefixe}`} className="text-text-3 text-xs font-semibold">
            Libellé affiché
          </label>
          <input
            id={`nom-${prefixe}`}
            name="name"
            required
            defaultValue={niveau?.name ?? ""}
            className={CHAMP}
          />
        </div>
        <div className="flex w-[90px] flex-col gap-1.5">
          <label htmlFor={`ordre-${prefixe}`} className="text-text-3 text-xs font-semibold">
            Ordre
          </label>
          <input
            id={`ordre-${prefixe}`}
            name="sortOrder"
            type="number"
            min={0}
            defaultValue={niveau?.sortOrder ?? 0}
            className={CHAMP}
          />
        </div>
        <div className="flex w-[130px] flex-col gap-1.5">
          <label htmlFor={`largeur-${prefixe}`} className="text-text-3 text-xs font-semibold">
            Largeur logo (px)
          </label>
          <input
            id={`largeur-${prefixe}`}
            name="logoMaxWidth"
            type="number"
            min={40}
            max={600}
            defaultValue={niveau?.logoMaxWidth ?? ""}
            placeholder="auto"
            className={CHAMP}
          />
        </div>
        <Bouton ton="principal" icone={niveau ? Save : Plus} type="submit" disabled={enCours}>
          {enCours ? "…" : niveau ? "Enregistrer" : "Ajouter"}
        </Bouton>
        {niveau && (
          <Bouton
            ton="danger"
            icone={Trash2}
            type="button"
            disabled={suppressionEnCours}
            onClick={auClicConfirme(
              {
                titre: "Supprimer ce niveau ?",
                texte: `« ${niveau.name} » disparaîtra du site. La suppression est refusée s'il porte encore des partenaires.`,
                confirmer: "Supprimer",
                ton: "danger",
              },
              () => {
                setErreurSuppression(null);
                startTransition(async () => {
                  const resultat = await supprimerNiveauAction(niveau.id);
                  if (resultat.erreur) setErreurSuppression(resultat.erreur);
                  else router.refresh();
                });
              },
            )}
          >
            Supprimer
          </Bouton>
        )}
      </form>

      {niveau && (
        <p className="text-text-3 mt-2 text-xs">
          {nombreSponsors ?? 0} partenaire{(nombreSponsors ?? 0) > 1 ? "s" : ""} à ce niveau
        </p>
      )}
      {etat.erreur && <p className="text-danger-text mt-2 text-sm">{etat.erreur}</p>}
      {etat.avis && <p className="text-accent-text mt-2 text-sm">{etat.avis}</p>}
      {erreurSuppression && <p className="text-danger-text mt-2 text-sm">{erreurSuppression}</p>}
    </div>
  );
}
