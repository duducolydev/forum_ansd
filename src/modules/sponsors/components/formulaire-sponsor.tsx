"use client";

import { useActionState } from "react";
import { creerSponsorAction, modifierSponsorAction, type EtatAction } from "../actions";
import { Save } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";

const etatInitial: EtatAction = {};

export interface ValeursSponsor {
  name: string;
  levelId: string;
  descriptionFr: string;
  descriptionEn: string;
  website: string;
  videoUrl: string;
  standNumber: string;
  contactName: string;
  contactEmail: string;
  isPublished: boolean;
}

const CHAMP = "border-border bg-bg text-text rounded-lg border px-3 py-2.5 text-sm";
const ETIQUETTE = "text-text-3 text-xs font-semibold";

function Champ({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={ETIQUETTE}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function FormulaireSponsor({
  sponsorId,
  niveaux,
  valeurs,
}: {
  sponsorId?: string;
  niveaux: { id: string; name: string }[];
  valeurs?: ValeursSponsor;
}) {
  const [etat, action, enCours] = useActionState(
    sponsorId ? modifierSponsorAction.bind(null, sponsorId) : creerSponsorAction,
    etatInitial,
  );

  return (
    <form action={action} className="border-border bg-surface rounded-xl border p-5">
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <Champ id="sponsor-name" label="Nom *">
          <input
            id="sponsor-name"
            name="name"
            required
            defaultValue={valeurs?.name ?? ""}
            className={CHAMP}
          />
        </Champ>
        <Champ id="sponsor-level" label="Niveau *">
          <select
            id="sponsor-level"
            name="levelId"
            required
            defaultValue={valeurs?.levelId ?? ""}
            className={CHAMP}
          >
            <option value="" disabled>
              Choisir…
            </option>
            {niveaux.map((niveau) => (
              <option key={niveau.id} value={niveau.id}>
                {niveau.name}
              </option>
            ))}
          </select>
        </Champ>
        <Champ id="sponsor-website" label="Site web">
          <input
            id="sponsor-website"
            name="website"
            placeholder="https://…"
            defaultValue={valeurs?.website ?? ""}
            className={CHAMP}
          />
        </Champ>
        <Champ id="sponsor-video" label="Vidéo (lien d'intégration)">
          <input
            id="sponsor-video"
            name="videoUrl"
            placeholder="https://…"
            defaultValue={valeurs?.videoUrl ?? ""}
            className={CHAMP}
          />
        </Champ>
        <Champ id="sponsor-stand" label="Numéro de stand">
          <input
            id="sponsor-stand"
            name="standNumber"
            defaultValue={valeurs?.standNumber ?? ""}
            className={CHAMP}
          />
        </Champ>
        <div className="flex items-end">
          <label className="text-text-2 flex items-center gap-2 py-2.5 text-sm">
            <input type="checkbox" name="isPublished" defaultChecked={valeurs?.isPublished} />
            Publié sur le site
          </label>
        </div>
        <Champ id="sponsor-desc-fr" label="Description (français)">
          <textarea
            id="sponsor-desc-fr"
            name="descriptionFr"
            rows={4}
            defaultValue={valeurs?.descriptionFr ?? ""}
            className={CHAMP}
          />
        </Champ>
        <Champ id="sponsor-desc-en" label="Description (anglais, repli FR si vide)">
          <textarea
            id="sponsor-desc-en"
            name="descriptionEn"
            rows={4}
            defaultValue={valeurs?.descriptionEn ?? ""}
            className={CHAMP}
          />
        </Champ>
      </div>

      <fieldset className="border-border mt-4 border-t pt-4">
        <legend className="text-text-3 mb-2 text-xs font-semibold">
          Contact interne — jamais affiché sur le site public
        </legend>
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <Champ id="sponsor-contact" label="Nom du contact">
            <input
              id="sponsor-contact"
              name="contactName"
              defaultValue={valeurs?.contactName ?? ""}
              className={CHAMP}
            />
          </Champ>
          <Champ id="sponsor-contact-email" label="E-mail du contact">
            <input
              id="sponsor-contact-email"
              name="contactEmail"
              type="email"
              defaultValue={valeurs?.contactEmail ?? ""}
              className={CHAMP}
            />
          </Champ>
        </div>
      </fieldset>

      {etat.erreur && <p className="text-danger-text mt-3 text-sm">{etat.erreur}</p>}
      {etat.avis && <p className="text-accent-text mt-3 text-sm">{etat.avis}</p>}

      <Bouton
        ton="principal"
        icone={Save}
        type="submit"
        disabled={enCours}

        className="mt-4"
      >
        {enCours ? "Enregistrement…" : sponsorId ? "Enregistrer" : "Créer le sponsor"}
      </Bouton>
    </form>
  );
}
