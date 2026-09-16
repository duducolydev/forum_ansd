/**
 * Contrôle des documents déposés en contribution (brief §5.10).
 *
 * Le type est déduit des **octets**, jamais de l'extension ni du `Content-Type`
 * annoncé par le navigateur. C'est la même règle que pour les photos de
 * participants et les logos de partenaires, et pour la même raison : un fichier
 * peut annoncer `application/pdf` et contenir tout autre chose.
 *
 * Ces documents ne sont ni ouverts ni interprétés par le serveur. Le risque
 * n'est donc pas l'exécution ici, mais la **distribution** : ce qui est déposé
 * est proposé au téléchargement sur le site public. Un exécutable renommé
 * `presentation.pdf` y deviendrait un lien de téléchargement signé par l'ANSD.
 */

export interface TypeDocument {
  extension: string;
  type: string;
  label: string;
}

/**
 * Poids maximal d'un document (brief §5.10).
 *
 * Ce plafond est la raison pour laquelle le dépôt passe par une **route** et
 * non par une Server Action : celles-ci s'arrêtent à 3 Mo et rejettent au-delà
 * sans qu'aucun code applicatif ne s'exécute, donc sans message (§13.7).
 */
export const DOCUMENT_MAX_BYTES = 50 * 1024 * 1024;

const PDF = Buffer.from("%PDF", "ascii");
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/**
 * Reconnaît un PDF ou un PPTX.
 *
 * Le PPTX est un ZIP : sa signature ne le distingue ni d'un DOCX, ni d'un XLSX,
 * ni d'une archive quelconque. On cherche donc la trace de la structure
 * PowerPoint dans l'en-tête de l'archive, où les noms d'entrées apparaissent en
 * clair. Ce n'est pas une lecture complète du catalogue ZIP — ce serait
 * disproportionné — mais c'est suffisant pour écarter une archive qui n'a rien
 * d'une présentation.
 */
export function detecterDocument(octets: Buffer): TypeDocument | null {
  if (octets.length < 8) return null;

  if (octets.subarray(0, 4).equals(PDF)) {
    return { extension: "pdf", type: "application/pdf", label: "PDF" };
  }

  if (octets.subarray(0, 4).equals(ZIP)) {
    const debut = octets.subarray(0, Math.min(octets.length, 8192)).toString("latin1");
    const estPresentation = debut.includes("ppt/") || debut.includes("[Content_Types].xml");
    if (!estPresentation) return null;
    // `[Content_Types].xml` seul ne suffit pas : il est présent dans tous les
    // formats Office. La mention `ppt/` tranche.
    if (!debut.includes("ppt/")) return null;
    return {
      extension: "pptx",
      type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      label: "PPTX",
    };
  }

  return null;
}

/** Message de refus, formulé pour l'agent et non pour le journal. */
export function refusDocument(): string {
  return "Seuls les fichiers PDF et PPTX sont acceptés.";
}
