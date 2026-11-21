import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { getActiveEdition } from "@/lib/edition";
import { prisma } from "@/lib/db";
import {
  filtrerParPresence,
  getListePresence,
  lireFiltrePresence,
} from "@/modules/attendance/service";
import { LIGNES_VIERGES_DEFAUT, LIGNES_VIERGES_MAX } from "@/modules/attendance/lignes-vierges";
import { renderListePresence, type FormeListe } from "@/modules/attendance/pdf";

export const dynamic = "force-dynamic";

/**
 * Export PDF des listes de présence (brief §5.6).
 *
 * `forme=EMARGEMENT` produit la feuille à faire signer, `forme=CONSTAT` la
 * liste de ce qui s'est réellement passé. Les filtres — jour, catégorie, zone —
 * sont ceux de l'écran, pour que le document imprimé corresponde exactement à
 * ce que l'utilisateur avait sous les yeux.
 *
 * `presence=PRESENTS|ABSENTS` réduit la liste aux uns ou aux autres ; sans
 * lui, elle les montre tous.
 *
 * Le filtre vaut pour les **deux** formes nominatives depuis le 21 novembre
 * 2026. La feuille d'émargement l'ignorait, au motif qu'elle se signe avant la
 * séance, quand personne n'est encore présent — vrai de la première séance
 * d'une journée, faux des suivantes : on fait signer ceux qui sont arrivés, et
 * on relance ceux qui manquent. Refuser le filtre obligeait à imprimer les six
 * cents attendus pour en faire signer deux.
 *
 * `forme=VIERGE` produit la même feuille d'émargement, **lignes vides**, pour
 * les porteurs de badges génériques — qui n'ont pas de fiche en base et ne
 * peuvent donc figurer sur aucune liste tirée de la base. `lignes=<n>` en règle
 * le nombre. Ni la base ni les filtres de présence n'y ont de part : une
 * catégorie choisie n'y sert qu'à titrer le document, pour qu'une liasse
 * « PROTOCOLE » ne se mélange pas à une liasse « PRESSE ».
 */

/** Nombre de lignes vides demandé, borné. Hors bornes ou illisible : le défaut. */
function lignesVierges(valeur: string | null): number {
  const nombre = Number(valeur);
  if (!Number.isInteger(nombre) || nombre < 1) return LIGNES_VIERGES_DEFAUT;
  return Math.min(nombre, LIGNES_VIERGES_MAX);
}

function jourValide(valeur: string | null): Date | null {
  if (!valeur || !/^\d{4}-\d{2}-\d{2}$/.test(valeur)) return null;
  const jour = new Date(`${valeur}T00:00:00.000Z`);
  return Number.isNaN(jour.getTime()) ? null : jour;
}

export async function GET(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!can(session, "presences.read")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const parametres = new URL(request.url).searchParams;
  const jour = jourValide(parametres.get("jour"));
  if (!jour) {
    return NextResponse.json({ error: "Jour attendu au format AAAA-MM-JJ." }, { status: 400 });
  }

  const demandee = parametres.get("forme");
  const forme: FormeListe =
    demandee === "EMARGEMENT" ? "EMARGEMENT" : demandee === "VIERGE" ? "VIERGE" : "CONSTAT";
  const vierge = forme === "VIERGE";
  const categoryId = parametres.get("categoryId") || undefined;
  const zoneId = parametres.get("zoneId") || undefined;
  // Une feuille vierge ne porte aucun nom : le filtre de présence n'a rien à
  // y filtrer, et la liste des attendus rien à y faire.
  const filtre = vierge ? "TOUS" : lireFiltrePresence(parametres.get("presence"));
  const lignesVides = vierge ? lignesVierges(parametres.get("lignes")) : 0;

  const edition = await getActiveEdition();
  const [attendus, categorie, zone] = await Promise.all([
    vierge ? [] : getListePresence(edition.id, { jour, categoryId, zoneId }),
    categoryId
      ? prisma.participantCategory.findUnique({
          where: { id: categoryId },
          select: { labelFr: true },
        })
      : null,
    zoneId ? prisma.zone.findUnique({ where: { id: zoneId }, select: { name: true } }) : null,
  ]);

  const lignes = filtrerParPresence(attendus, filtre);

  /*
   * La feuille vierge annonce à quoi elle sert dès son sous-titre : posée sur
   * un comptoir d'accueil à côté des liasses nominatives, rien d'autre ne la
   * distinguerait d'une feuille d'émargement dont les noms n'auraient pas été
   * imprimés.
   */
  const precisions = (
    vierge
      ? ["Badges génériques — à remplir et signer sur place", categorie?.labelFr]
      : [categorie?.labelFr, zone?.name]
  ).filter(Boolean);
  /*
   * Le titre porte le filtre : imprimé puis posé sur une table, un document
   * qui ne dit pas « absents » se confond avec la liste complète.
   */
  const restriction =
    filtre === "PRESENTS" ? " — présents" : filtre === "ABSENTS" ? " — absents" : "";
  const titre = vierge
    ? "Feuille d'émargement vierge"
    : forme === "EMARGEMENT"
      ? `Feuille d'émargement${restriction}`
      : filtre === "PRESENTS"
        ? "Liste des présents"
        : filtre === "ABSENTS"
          ? "Liste des absents"
          : "Liste de présence";
  const pdf = await renderListePresence({
    editionName: edition.title,
    titre,
    sousTitre: precisions.length > 0 ? precisions.join(" · ") : "Toutes catégories",
    jour,
    forme,
    lignes,
    filtre,
    attendus: attendus.length,
    lignesVides,
  });

  await audit.log({
    actorType: "USER",
    actorUserId: session?.user?.id,
    action: "presences.export",
    entity: "Edition",
    entityId: edition.id,
    after: {
      forme,
      jour: jour.toISOString().slice(0, 10),
      lignes: vierge ? lignesVides : lignes.length,
      presence: filtre,
      categoryId,
      zoneId,
    },
  });

  const suffixe = filtre === "TOUS" ? "" : `-${filtre.toLowerCase()}`;
  const nom = `presences-${jour.toISOString().slice(0, 10)}-${forme.toLowerCase()}${suffixe}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nom}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
