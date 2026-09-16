import type { Contribution } from "@prisma/client";
import { Download, FileText, Image as ImageIcon, Play, Quote } from "lucide-react";
import { LienSiteExterne } from "@/components/site/bouton-site";
import { MODELES, reconnaitreVideo, urlIntegration, type TypeContribution } from "../schema";

/**
 * Rendu public d'une contribution.
 *
 * Trois formes seulement, selon ce que le type porte : du texte, un fichier, une
 * vidéo. C'est volontairement pauvre en variations — ces blocs s'empilent par
 * dizaines sur une fiche de session, et dix présentations visuelles
 * différentes s'y liraient comme un catalogue.
 *
 * Le texte est rendu **tel quel**, retours à la ligne préservés : le portail
 * stocke du texte brut et non du HTML (T17), ce qui évite d'avoir à
 * l'assainir. La saisie enrichie viendra avec l'éditeur, et avec la
 * sanitisation serveur qu'il impose.
 */
export function BlocContribution({ contribution }: { contribution: Contribution }) {
  const modele = MODELES[contribution.type as TypeContribution];
  const video = contribution.url ? reconnaitreVideo(contribution.url) : null;

  return (
    <article className="border-border bg-surface rounded-xl border p-5">
      <p className="text-accent-text mb-1 text-xs font-semibold tracking-wide uppercase">
        {modele.label}
      </p>
      <h3 className="text-heading mb-2 text-lg">{contribution.title}</h3>

      {contribution.body && (
        <p className="text-text-2 leading-relaxed whitespace-pre-line">{contribution.body}</p>
      )}

      {contribution.filePath && modele.fichier === "image" && (
        /* eslint-disable-next-line @next/next/no-img-element -- servie par une route contrôlée, hors optimiseur */
        <img
          src={`/api/v1/contributions/${contribution.id}/fichier`}
          alt={contribution.title}
          className="border-border bg-bg-2 mt-3 w-full rounded-lg border object-contain"
        />
      )}

      {contribution.filePath && modele.fichier === "document" && (
        <div className="mt-3">
          <LienSiteExterne
            href={`/api/v1/contributions/${contribution.id}/fichier`}
            taille="compact"
            icone={Download}
          >
            Télécharger le document
          </LienSiteExterne>
        </div>
      )}

      {video && (
        /*
         * L'adresse d'intégration est **reconstruite** à partir d'un
         * identifiant validé, jamais reprise telle qu'elle a été saisie : un
         * champ d'URL libre dans une `<iframe>` laisserait insérer n'importe
         * quelle page sur le site public.
         */
        <div className="border-border mt-3 aspect-video overflow-hidden rounded-lg border">
          <iframe
            src={urlIntegration(video)}
            title={contribution.title}
            allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="h-full w-full"
          />
        </div>
      )}
    </article>
  );
}

/** Icône résumant ce qu'apporte une contribution, pour les listes. */
export function iconeDeType(type: TypeContribution) {
  const modele = MODELES[type];
  if (modele.lien) return Play;
  if (modele.fichier === "image") return ImageIcon;
  if (modele.fichier === "document") return FileText;
  return Quote;
}
