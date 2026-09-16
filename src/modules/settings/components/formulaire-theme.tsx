"use client";

import { useActionState, useState } from "react";
import { Save } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { enregistrerThemeAction, type EtatAction } from "../actions";
import { CONTRASTE_MIN_LARGE, FONDS_PAGE } from "../regles";
import { ANIMATIONS, POLICES, type ThemeEdition } from "../schema";
import { CHAMP, Champ, Panneau, Retour } from "./champs";
import { ChoixCouleur } from "./choix-couleur";

const etatInitial: EtatAction = {};

export function FormulaireTheme({ valeurs }: { valeurs: ThemeEdition }) {
  const [etat, action, enCours] = useActionState(enregistrerThemeAction, etatInitial);
  const [theme, setTheme] = useState<ThemeEdition>(valeurs);

  function majChamp<C extends keyof ThemeEdition>(champ: C, valeur: ThemeEdition[C]) {
    setTheme((precedent) => ({ ...precedent, [champ]: valeur }));
  }

  return (
    <Panneau
      titre="Apparence"
      description="Les couleurs sont libres, mais vérifiées : sous le seuil, l'enregistrement est refusé. C'est ce qui tient le 100/100 d'accessibilité obtenu sur les pages publiques."
    >
      <form action={action} className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <ChoixCouleur
          nom="primaire"
          label="Couleur d'action (boutons)"
          valeur={theme.primaire}
          onChange={(couleur) => majChamp("primaire", couleur)}
        />
        <ChoixCouleur
          nom="secondaire"
          label="Couleur des liens et des titres"
          valeur={theme.secondaire}
          onChange={(couleur) => majChamp("secondaire", couleur)}
        />
        <div className="md:col-span-2">
          <ChoixCouleur
            nom="accent"
            label="Couleur d'accent"
            valeur={theme.accent}
            onChange={(couleur) => majChamp("accent", couleur)}
            seuil={CONTRASTE_MIN_LARGE}
            fonds={FONDS_PAGE}
            aide="Elle dessine le contour de focus au clavier : elle doit se détacher des deux fonds — clair et sombre — d'où le seuil de 3:1 sur le moins favorable des deux."
          />
        </div>

        <Champ
          id="theme-police"
          label="Police du texte courant"
          aide="Les titres gardent la police d'affichage de la charte : la changer ne serait plus un réglage mais une refonte."
        >
          <select id="theme-police" name="police" defaultValue={valeurs.police} className={CHAMP}>
            {POLICES.map((police) => (
              <option key={police.cle} value={police.cle}>
                {police.label}
              </option>
            ))}
          </select>
        </Champ>

        <Champ id="theme-rayon" label="Arrondi des cartes et boutons (px)">
          <input
            id="theme-rayon"
            name="rayon"
            type="number"
            min={0}
            max={28}
            defaultValue={valeurs.rayon}
            className={CHAMP}
          />
        </Champ>

        <Champ
          id="theme-animation"
          label="Animations"
          aide="Toujours désactivées pour les visiteurs qui demandent moins d'animation à leur système."
        >
          <select
            id="theme-animation"
            name="animation"
            defaultValue={valeurs.animation}
            className={CHAMP}
          >
            {ANIMATIONS.map((animation) => (
              <option key={animation.cle} value={animation.cle}>
                {animation.label}
              </option>
            ))}
          </select>
        </Champ>

        <div className="md:col-span-2">
          <Bouton ton="principal" icone={Save} type="submit" disabled={enCours}>
            {enCours ? "Enregistrement…" : "Enregistrer"}
          </Bouton>
          <Retour etat={etat} />
        </div>
      </form>
    </Panneau>
  );
}
