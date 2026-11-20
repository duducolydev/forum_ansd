import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { getListePresence, lireFiltrePresence } from "@/modules/attendance/service";
import { ListePresents } from "@/modules/attendance/components/liste-presents";

export const dynamic = "force-dynamic";

const dateLongue = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function enIso(jour: Date): string {
  return jour.toISOString().slice(0, 10);
}

/** Date `AAAA-MM-JJ` demandée en paramètre, ou `null` si absente ou mal formée. */
function jourValide(valeur: string | undefined): Date | null {
  if (!valeur || !/^\d{4}-\d{2}-\d{2}$/.test(valeur)) return null;
  const jour = new Date(`${valeur}T00:00:00.000Z`);
  return Number.isNaN(jour.getTime()) || enIso(jour) !== valeur ? null : jour;
}

/**
 * Qui était là, nommément (20 novembre 2026).
 *
 * Le tableau de bord des présences donnait un **chiffre** — « 2 présents » —
 * sans moyen de savoir qui. Pour le savoir, il fallait exporter un PDF, ce qui
 * est une démarche d'archivage, pas de consultation : on ne sort pas un
 * document pour vérifier si quelqu'un est arrivé.
 *
 * La page sert les **attendus** de la journée, présents et absents, et laisse
 * le navigateur filtrer. Les absents sont là volontairement : savoir qui
 * manque est souvent la vraie question au comptoir, et le filtre par défaut
 * reste sur les présents puisqu'on arrive ici depuis la tuile « Présents ».
 */
export default async function ListePresencePage({
  searchParams,
}: {
  searchParams: Promise<{ jour?: string; presence?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/connexion");
  if (!can(session, "presences.read")) {
    return (
      <div className="border-border bg-surface text-text-2 rounded-xl border p-5">
        Votre rôle ne donne pas accès aux présences.
      </div>
    );
  }

  const edition = await getActiveEdition();
  const { jour: jourDemande, presence } = await searchParams;
  const choisi = jourValide(jourDemande) ?? new Date(enIso(new Date()) + "T00:00:00.000Z");

  const lignes = await getListePresence(edition.id, { jour: choisi });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href={`/admin/presences?jour=${enIso(choisi)}`} className="text-link text-sm">
          ← Présences
        </Link>
        <h2 className="mt-1 text-2xl">Liste des présents</h2>
        <p className="text-text-3 text-sm">
          {dateLongue.format(choisi)} — {lignes.length} personne
          {lignes.length > 1 ? "s" : ""} attendue{lignes.length > 1 ? "s" : ""} ce jour.
        </p>
      </div>

      <ListePresents
        presenceInitiale={lireFiltrePresence(presence ?? "PRESENTS")}
        lignes={lignes.map((ligne) => ({
          publicId: ligne.publicId,
          nom: ligne.nom,
          organisation: ligne.organisation,
          fonction: ligne.fonction,
          categorie: ligne.categorie,
          pays: ligne.pays,
          // Sérialisé : une `Date` ne traverse pas la frontière serveur/client.
          premierPassage: ligne.premierPassage?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
