import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { Eyebrow, Reveal } from "@/components/motion/Reveal";
import { LienSite } from "@/components/site/bouton-site";

/**
 * En-tête d'une section de l'accueil (brief §4) : étiquette dont le trait se
 * dessine (révélée depuis la gauche), titre (depuis le bas), bouton « voir
 * tout » (depuis la droite).
 *
 * `etiquette` accepte un nœud : l'étiquette des actualités se « décode »
 * lettre par lettre (`ScrambleText`).
 */
export function TeteSection({
  etiquette,
  titre,
  icone: Icone,
  lien,
}: {
  etiquette: ReactNode;
  titre: string;
  icone?: LucideIcon;
  lien?: { href: string; libelle: string };
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <Reveal variant="left">
          <Eyebrow>{etiquette}</Eyebrow>
        </Reveal>
        <Reveal variant="up">
          <h2 className="titre-section">
            {Icone && <Icone aria-hidden size={34} strokeWidth={2} className="shrink-0" />}
            {titre}
          </h2>
        </Reveal>
      </div>
      {lien && (
        <Reveal variant="right" className="mb-10">
          <LienSite href={lien.href} iconeApres={ArrowRight}>
            {lien.libelle}
          </LienSite>
        </Reveal>
      )}
    </div>
  );
}
