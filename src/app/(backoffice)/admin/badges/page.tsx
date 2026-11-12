import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { getActiveEdition } from "@/lib/edition";
import { compter, compterAncienGabarit, lister, type FiltreBadges } from "@/modules/badges/bulk";
import { GestionBadges } from "@/modules/badges/components/gestion-badges";

export const dynamic = "force-dynamic";

const LIMITE = 200;

function lireFiltre(parametres: Record<string, string | undefined>): FiltreBadges {
  const etat = parametres.etat;
  return {
    categoryId: parametres.categoryId || undefined,
    delegationId: parametres.delegationId || undefined,
    etat: etat === "SANS" || etat === "AVEC" || etat === "REVOQUE" ? etat : undefined,
  };
}

export default async function BadgesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/connexion");
  if (!can(session, "badges.print") && !can(session, "badges.generate")) {
    return (
      <div className="border-border bg-surface text-text-2 rounded-xl border p-5">
        Votre rôle ne donne pas accès aux badges.
      </div>
    );
  }

  const parametres = await searchParams;
  const filtre = lireFiltre(parametres);
  const edition = await getActiveEdition();

  /*
   * Les compteurs du filtre sont comptés **en base**, et non sur les lignes
   * affichées : les actions de masse portent sur tout le filtre tant qu'aucune
   * case n'est cochée, et un bouton qui annoncerait « 200 » là où le périmètre
   * en contient 1 200 serait un piège.
   *
   * Un filtre d'état restreint déjà ce que l'action pourra traiter : rien à
   * générer parmi des badges existants, rien à refaire parmi des révoqués. Le
   * compteur le dit à zéro plutôt que d'aller compter en dehors du filtre, ce
   * qu'un `etat` écrasé ferait sans bruit.
   */
  const sansBadgeValide = filtre.etat === "AVEC" || filtre.etat === "REVOQUE";
  const sansBadgeARefaire = filtre.etat === "SANS" || filtre.etat === "REVOQUE";
  const sansRevoque = filtre.etat === "SANS" || filtre.etat === "AVEC";

  const [lignes, total, manquants, revoques, existants, ancienGabarit, categories, delegations] =
    await Promise.all([
      lister(edition.id, filtre, LIMITE),
      compter(edition.id, filtre),
      sansBadgeValide ? 0 : compter(edition.id, { ...filtre, etat: "SANS" }),
      sansRevoque ? 0 : compter(edition.id, { ...filtre, etat: "REVOQUE" }),
      sansBadgeARefaire ? 0 : compter(edition.id, { ...filtre, etat: "AVEC" }),
      sansBadgeARefaire ? 0 : compterAncienGabarit(edition.id, filtre),
      prisma.participantCategory.findMany({
        where: { editionId: edition.id, isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, labelFr: true },
      }),
      prisma.delegation.findMany({
        where: { editionId: edition.id },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl">Badges</h2>
        <p className="text-text-3 text-sm">
          Génération en lot, export par délégation et planche d&apos;impression.
        </p>
      </div>

      <Suspense fallback={null}>
        <GestionBadges
          lignes={lignes}
          limite={LIMITE}
          compteurs={{ total, manquants, revoques, existants, ancienGabarit }}
          categories={categories}
          delegations={delegations}
          peutGenerer={can(session, "badges.generate")}
          peutRevoquer={can(session, "badges.revoke")}
        />
      </Suspense>
    </div>
  );
}
