import { z } from "zod";

/**
 * Recherche et filtres de la liste des délégations, portés par l'URL.
 *
 * Le filtrage se fait en mémoire, sur la liste complète de l'édition : il y a
 * quelques dizaines de délégations, la liste n'est pas paginée, et la
 * situation « complète » compare deux nombres (membres et plafond) qu'une
 * requête Prisma ne sait pas confronter.
 */
export const SITUATIONS_DELEGATION = {
  "sans-chef": "Sans chef de délégation",
  "sans-referent": "Sans référent",
  vide: "Sans membre",
  complete: "Complète",
} as const;

export type SituationDelegation = keyof typeof SITUATIONS_DELEGATION;

export const delegationSearchSchema = z.object({
  q: z.string().trim().max(200).optional().or(z.literal("")),
  country: z.string().trim().max(100).optional().or(z.literal("")),
  referentId: z.string().trim().optional().or(z.literal("")),
  situation: z
    .enum(Object.keys(SITUATIONS_DELEGATION) as [SituationDelegation, ...SituationDelegation[]])
    .optional()
    .or(z.literal("")),
});

export type DelegationSearch = z.infer<typeof delegationSearchSchema>;

/** Ce que le filtre lit d'une délégation : la ligne de la liste du BackOffice. */
export interface DelegationFiltrable {
  name: string;
  country: string | null;
  institution: string | null;
  referentId: string | null;
  maxMembers: number | null;
  headParticipant: { firstName: string; lastName: string } | null;
  referent: { name: string } | null;
  _count: { members: number };
}

/** Minuscules et sans accents : « senegal » trouve « Sénégal ». */
function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Chaque mot cherché doit figurer dans l'un des champs : nom, pays,
 * institution, chef ou référent. « Mali INS » trouve la délégation de l'INS du
 * Mali.
 */
export function filtrerDelegations<T extends DelegationFiltrable>(
  delegations: T[],
  recherche: DelegationSearch,
): T[] {
  const mots = normaliser(recherche.q ?? "")
    .split(/\s+/)
    .filter(Boolean);
  const pays = normaliser(recherche.country ?? "");

  return delegations.filter((delegation) => {
    if (pays && normaliser(delegation.country ?? "") !== pays) return false;

    if (recherche.referentId === "aucun") {
      if (delegation.referentId) return false;
    } else if (recherche.referentId && delegation.referentId !== recherche.referentId) {
      return false;
    }

    switch (recherche.situation) {
      case "sans-chef":
        if (delegation.headParticipant) return false;
        break;
      case "sans-referent":
        if (delegation.referentId) return false;
        break;
      case "vide":
        if (delegation._count.members > 0) return false;
        break;
      case "complete":
        if (!delegation.maxMembers || delegation._count.members < delegation.maxMembers) {
          return false;
        }
        break;
    }

    if (mots.length === 0) return true;
    const texte = normaliser(
      [
        delegation.name,
        delegation.country,
        delegation.institution,
        delegation.headParticipant?.firstName,
        delegation.headParticipant?.lastName,
        delegation.referent?.name,
      ]
        .filter(Boolean)
        .join(" "),
    );
    return mots.every((mot) => texte.includes(mot));
  });
}
