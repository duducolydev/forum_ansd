"use client";

import dynamic from "next/dynamic";
import type { Direct } from "@/modules/settings/schema";

/**
 * Décor animé de l'écran d'attente, choisi en BackOffice.
 *
 * Chargement différé et sans rendu serveur, comme `ReseauHero` : un canvas n'a
 * rien à rendre avant que le navigateur connaisse la taille de la fenêtre, et
 * le script du décor ne doit pas retarder l'affichage du message — qui est, lui,
 * la seule chose que le téléspectateur attend.
 *
 * Trois décors et « aucun », plutôt qu'un seul imposé : la pause ne se regarde
 * pas de la même façon depuis la salle, sur le vidéoprojecteur du hall, et sur
 * un téléphone. Le comité tranchera à l'usage, sans déploiement.
 */

const Reseau = dynamic(() => import("@/components/home/HeroNetwork"), { ssr: false });
const Ondes = dynamic(() => import("./fond-ondes"), { ssr: false });
const Chiffres = dynamic(() => import("./fond-chiffres"), { ssr: false });

export function FondDirect({ fond }: { fond: Direct["fond"] }) {
  if (fond === "aucun") return null;
  if (fond === "ondes") return <Ondes />;
  if (fond === "chiffres") return <Chiffres />;
  // Le réseau de données est celui des bandeaux du site : l'écran d'attente
  // reste visiblement une page du Forum, pas une mire.
  return <Reseau />;
}
