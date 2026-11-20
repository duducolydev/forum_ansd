import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { adresseClient } from "@/lib/adresse-client";
import { rateLimit } from "@/lib/rate-limit";
import { parametresEdition } from "@/modules/settings/service";
import { jetonValide } from "@/modules/direct/audience";
import { enregistrerBattement } from "@/modules/direct/audience-service";

/**
 * Battement d'un spectateur de la retransmission (20 novembre 2026).
 *
 * Appelée toutes les minutes par la page `/direct`, **lecteur lancé
 * seulement**. Elle n'existe que pour alimenter le compteur d'affluence du
 * BackOffice ; elle ne renvoie rien d'utile au navigateur, et son échec ne
 * doit jamais se voir côté public — on ne gâche pas une retransmission pour
 * une statistique.
 *
 * ## Ce que cette route ne fait pas
 *
 * Elle ne pose aucun cookie, ne lit aucune session, n'enregistre aucune
 * adresse. Le jeton reçu est tiré au hasard par le navigateur et ne désigne
 * personne. L'adresse du client sert au seul comptage de débit, en mémoire ou
 * dans Redis, et n'est pas écrite en base.
 *
 * ## Débit
 *
 * 6 appels par minute et par adresse. Le navigateur en émet un ; six laissent
 * passer plusieurs onglets et un réseau d'entreprise derrière une seule
 * adresse publique — ce qui sera le cas des salles de l'ANSD — sans laisser
 * une boucle gonfler le compteur indéfiniment.
 *
 * Le chiffre reste **indicatif** : la route est publique, et rien n'empêche
 * d'inventer des jetons. Le BackOffice annonce une affluence, pas une mesure
 * d'audience certifiée.
 */
export const dynamic = "force-dynamic";

export async function POST(requete: Request) {
  const ip = adresseClient(await headers());
  const debit = await rateLimit(`direct-presence:${ip}`, 6, 60);
  if (!debit.allowed) {
    return NextResponse.json(
      { erreur: "Trop de requêtes." },
      { status: 429, headers: { "Retry-After": String(debit.retryAfterSeconds) } },
    );
  }

  let jeton: unknown;
  try {
    jeton = ((await requete.json()) as { jeton?: unknown }).jeton;
  } catch {
    return NextResponse.json({ erreur: "Corps illisible." }, { status: 400 });
  }

  if (!jetonValide(jeton)) {
    return NextResponse.json({ erreur: "Jeton invalide." }, { status: 400 });
  }

  /*
   * La page close ne doit rien compter : si la retransmission a été fermée en
   * BackOffice, un battement resté en vol dans un onglet oublié ne doit pas
   * continuer d'alimenter la courbe.
   */
  const { edition, parametres } = await parametresEdition();
  if (!parametres.direct.actif) return new NextResponse(null, { status: 204 });

  try {
    await enregistrerBattement(edition.id, jeton);
  } catch (erreur) {
    // Journalisé, jamais remonté : une statistique perdue ne vaut pas un
    // message d'erreur chez un spectateur.
    console.error("Battement du direct non enregistré.", erreur);
  }

  return new NextResponse(null, { status: 204 });
}
