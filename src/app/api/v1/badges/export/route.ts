import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { exporterZip, type FiltreBadges } from "@/modules/badges/bulk";

export const dynamic = "force-dynamic";

/**
 * Archive ZIP des badges (brief §5.4).
 *
 * `?rangement=plat` donne tous les PDF côte à côte plutôt qu'un dossier par
 * délégation. Le paramètre vit dans l'URL comme les filtres, et pour la même
 * raison : le lien d'export doit porter en entier ce qu'il va produire, et
 * rester collable.
 *
 * Le nombre de badges manquants voyage dans un en-tête plutôt que dans le
 * corps : le corps est l'archive elle-même, et l'utilisateur doit pouvoir
 * apprendre qu'il manque vingt fichiers sans avoir à l'ouvrir.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!can(session, "badges.print")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const parametres = new URL(request.url).searchParams;
  const etat = parametres.get("etat");
  const exporte = parametres.get("export");
  const filtre: FiltreBadges = {
    categoryId: parametres.get("categoryId") || undefined,
    delegationId: parametres.get("delegationId") || undefined,
    etat: etat === "SANS" || etat === "AVEC" || etat === "REVOQUE" ? etat : undefined,
    export: exporte === "JAMAIS" || exporte === "DEJA" ? exporte : undefined,
  };

  const edition = await getActiveEdition();
  const archive = await exporterZip(
    edition.id,
    filtre,
    session?.user?.id,
    parametres.get("rangement") === "plat" ? "plat" : "delegation",
    /*
     * Le marquage est **demandé**, jamais supposé. Cette route reste une URL
     * GET : une adresse rejouée depuis l'historique, un signet ou un
     * préchargement ne doit pas déclarer trois cents badges partis à
     * l'impression. L'écran pose le drapeau quand l'opérateur l'a coché.
     */
    parametres.get("marquer") === "1",
  );

  return new NextResponse(new Uint8Array(archive.fichier), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${archive.nom}"`,
      /*
       * Posé explicitement : c'est de cette valeur que l'écran tire le
       * pourcentage d'avancement (`bouton-export-zip.tsx`). Sans elle, la
       * réponse part en « chunked » et la barre ne peut rien mesurer.
       */
      "Content-Length": String(archive.fichier.byteLength),
      "X-Badges-Inclus": String(archive.inclus),
      "X-Badges-Manquants": String(archive.manquants),
      "Cache-Control": "private, no-store",
    },
  });
}
