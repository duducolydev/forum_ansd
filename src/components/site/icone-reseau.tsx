import type { ComponentType } from "react";
import {
  FaFacebookF,
  FaInstagram,
  FaLinkedinIn,
  FaTiktok,
  FaXTwitter,
  FaYoutube,
} from "react-icons/fa6";
import { Globe } from "lucide-react";
import type { Reseau } from "@/modules/settings/schema";

/**
 * Logo de chaque réseau social (1er octobre 2026).
 *
 * Les logos de marque viennent de Font Awesome (paquet `react-icons`) : des
 * tracés officiels, intégrés au code — aucun appel externe, rien à ouvrir dans
 * la CSP. lucide, l'iconothèque du reste du site, a retiré ses logos de
 * marque ; les redessiner de mémoire aurait donné des logos approximatifs.
 */
const ICONES: Record<
  Reseau,
  ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>
> = {
  facebook: FaFacebookF,
  linkedin: FaLinkedinIn,
  x: FaXTwitter,
  instagram: FaInstagram,
  tiktok: FaTiktok,
  youtube: FaYoutube,
  site: Globe,
};

export function IconeReseau({
  reseau,
  taille = 16,
  className,
}: {
  reseau: string;
  taille?: number;
  className?: string;
}) {
  const Icone = ICONES[reseau as Reseau] ?? Globe;
  return <Icone aria-hidden size={taille} className={className} />;
}
