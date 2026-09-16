"use client";

import { Dices } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";

import { useState } from "react";
import { LONGUEUR_MDP_MIN } from "../schema";

/**
 * Alphabet sans caractères ambigus (ni O/0, ni l/1) : ces mots de passe sont
 * recopiés à la main ou dictés au téléphone avant la première connexion.
 */
const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#%&*-+=?";

function tirer(): string {
  const octets = new Uint32Array(16);
  crypto.getRandomValues(octets);
  return Array.from(octets, (valeur) => ALPHABET[valeur % ALPHABET.length]).join("");
}

/**
 * Champ mot de passe accompagné d'un tirage aléatoire.
 *
 * Le tirage se fait **dans le navigateur** et la valeur reste visible : celui
 * qui crée le compte doit pouvoir la transmettre. Elle n'est jamais renvoyée
 * par le serveur ensuite — ni dans le journal d'audit, ni dans la liste.
 */
export function GenerateurMotDePasse({
  id,
  name = "password",
  label = "Mot de passe",
}: {
  id: string;
  name?: string;
  label?: string;
}) {
  const [valeur, setValeur] = useState("");

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-text-3 text-xs font-semibold">
        {label} ({LONGUEUR_MDP_MIN} caractères minimum)
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          name={name}
          type="text"
          value={valeur}
          onChange={(event) => setValeur(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="border-border bg-bg text-text flex-1 rounded-lg border px-3 py-2.5 font-mono text-sm"
        />
        <Bouton
          ton="secondaire"
          icone={Dices}
          type="button"
          onClick={() => setValeur(tirer())}
          titre="Tirer un mot de passe au hasard"
          className="shrink-0"
        >
          Tirer
        </Bouton>
      </div>
    </div>
  );
}
