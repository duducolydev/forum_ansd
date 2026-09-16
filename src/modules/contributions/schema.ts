import { z } from "zod";

/**
 * Contributions et Actes (brief §5.10, lot 3).
 *
 * Une contribution est un **bloc typé rattaché à une session** : la
 * problématique posée, les questions clés, une présentation déposée, une photo,
 * une vidéo, la synthèse, une recommandation. Mises bout à bout, elles forment
 * la capitalisation du Forum, puis les Actes.
 *
 * Le découpage en types plutôt qu'en champ libre n'est pas décoratif : c'est ce
 * qui permettra de compiler les Actes automatiquement — une section par
 * session, faite des synthèses et des recommandations — sans demander à
 * personne de retrouver, dans un texte continu, ce qui en relève.
 */

export const TYPES_CONTRIBUTION = [
  "PROBLEM",
  "OBJECTIVES",
  "KEY_QUESTIONS",
  "PRESENTATION",
  "DOCUMENT",
  "PHOTO",
  "VIDEO",
  "SYNTHESIS",
  "RECOMMENDATION",
  "CONCLUSION",
] as const;

export type TypeContribution = (typeof TYPES_CONTRIBUTION)[number];

/** Ce que chaque type attend, et donc ce que l'écran doit proposer. */
export interface ModeleType {
  label: string;
  description: string;
  /** Le bloc porte-t-il un corps de texte ? */
  texte: boolean;
  /** Accepte-t-il un fichier déposé, et lequel ? */
  fichier: "aucun" | "document" | "image";
  /** Accepte-t-il un lien externe (vidéo) ? */
  lien: boolean;
  /** Entre dans la compilation des Actes du Forum. */
  dansLesActes: boolean;
}

export const MODELES: Record<TypeContribution, ModeleType> = {
  PROBLEM: {
    label: "Problématique",
    description: "La question que la session pose.",
    texte: true,
    fichier: "aucun",
    lien: false,
    dansLesActes: true,
  },
  OBJECTIVES: {
    label: "Objectifs",
    description: "Ce que la session vise à produire.",
    texte: true,
    fichier: "aucun",
    lien: false,
    dansLesActes: true,
  },
  KEY_QUESTIONS: {
    label: "Questions clés",
    description: "Les questions soumises aux panélistes.",
    texte: true,
    fichier: "aucun",
    lien: false,
    dansLesActes: true,
  },
  PRESENTATION: {
    label: "Présentation",
    description: "Le support d'un intervenant (PDF ou PPTX).",
    texte: true,
    fichier: "document",
    lien: false,
    dansLesActes: false,
  },
  DOCUMENT: {
    label: "Document",
    description: "Tout autre document de séance (PDF ou PPTX).",
    texte: true,
    fichier: "document",
    lien: false,
    dansLesActes: false,
  },
  PHOTO: {
    label: "Photo",
    description: "Une image de la session.",
    texte: true,
    fichier: "image",
    lien: false,
    dansLesActes: false,
  },
  VIDEO: {
    label: "Vidéo",
    description: "Un lien YouTube ou Vimeo. Les vidéos ne sont pas hébergées ici.",
    texte: true,
    fichier: "aucun",
    lien: true,
    dansLesActes: false,
  },
  SYNTHESIS: {
    label: "Synthèse",
    description: "Ce qui s'est dit, en quelques paragraphes.",
    texte: true,
    fichier: "aucun",
    lien: false,
    dansLesActes: true,
  },
  RECOMMENDATION: {
    label: "Recommandation",
    description: "Une recommandation issue de la session.",
    texte: true,
    fichier: "aucun",
    lien: false,
    dansLesActes: true,
  },
  CONCLUSION: {
    label: "Conclusion",
    description: "Le mot de clôture de la session.",
    texte: true,
    fichier: "aucun",
    lien: false,
    dansLesActes: true,
  },
};

export const TYPE_LABELS: Record<TypeContribution, string> = Object.fromEntries(
  Object.entries(MODELES).map(([cle, modele]) => [cle, modele.label]),
) as Record<TypeContribution, string>;

/**
 * Hébergeurs vidéo acceptés.
 *
 * Liste fermée, et volontairement : un champ d'URL libre intégré dans une
 * `<iframe>` laisse insérer n'importe quelle page sur le site public. Ici, seul
 * un identifiant de vidéo extrait d'une adresse reconnue est conservé, et
 * l'adresse d'intégration est **reconstruite** par le code.
 */
export const HEBERGEURS = ["youtube", "vimeo"] as const;
export type Hebergeur = (typeof HEBERGEURS)[number];

export interface VideoReconnue {
  hebergeur: Hebergeur;
  identifiant: string;
}

export function reconnaitreVideo(url: string): VideoReconnue | null {
  let adresse: URL;
  try {
    adresse = new URL(url.trim());
  } catch {
    return null;
  }
  if (adresse.protocol !== "https:") return null;

  const hote = adresse.hostname.replace(/^www\./, "");

  if (hote === "youtu.be") {
    const identifiant = adresse.pathname.slice(1);
    return /^[\w-]{6,20}$/.test(identifiant) ? { hebergeur: "youtube", identifiant } : null;
  }
  if (hote === "youtube.com" || hote === "m.youtube.com") {
    const identifiant = adresse.searchParams.get("v") ?? "";
    return /^[\w-]{6,20}$/.test(identifiant) ? { hebergeur: "youtube", identifiant } : null;
  }
  if (hote === "vimeo.com" || hote === "player.vimeo.com") {
    const identifiant = adresse.pathname.split("/").filter(Boolean).pop() ?? "";
    return /^\d{6,12}$/.test(identifiant) ? { hebergeur: "vimeo", identifiant } : null;
  }
  return null;
}

/** Adresse d'intégration, reconstruite et jamais reprise telle quelle. */
export function urlIntegration(video: VideoReconnue): string {
  return video.hebergeur === "youtube"
    ? `https://www.youtube-nocookie.com/embed/${video.identifiant}`
    : `https://player.vimeo.com/video/${video.identifiant}`;
}

export const contributionSchema = z.object({
  sessionId: z.string().min(1),
  type: z.enum(TYPES_CONTRIBUTION),
  title: z.string().trim().min(1, "Le titre est obligatoire.").max(200),
  body: z.string().trim().max(20_000).optional().default(""),
  url: z.string().trim().max(500).optional().default(""),
  speakerId: z.string().trim().optional().default(""),
  isPublished: z.boolean().default(false),
});

export type ContributionInput = z.infer<typeof contributionSchema>;
