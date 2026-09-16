import { NextResponse } from "next/server";
import { getSpeakerSession } from "@/modules/speakers/session";
import { PRESENTATION_MAX_BYTES } from "@/modules/speakers/constantes";
import { savePresentation, SpeakerRuleError } from "@/modules/speakers/service";

/**
 * Dépôt de sa présentation par un intervenant (brief §5.8, PLAN.md §15).
 *
 * ## Pourquoi une route
 *
 * Le dépôt passait par une Server Action. Or celles-ci refusent tout envoi de
 * plus de 3 Mo **avant** d'exécuter le moindre code, sans message (§13.7) :
 * l'espace annonçait 20 Mo, et l'intervenant dont le support dépassait 3 Mo
 * cliquait sans que rien ne se passe. C'est le même défaut que celui des
 * illustrations de section, et la même réponse que pour les contributions.
 *
 * L'authentification est celle de l'espace intervenant — le cookie posé par le
 * lien magique — et non celle du BackOffice. Ce cookie est `SameSite=Lax` : un
 * site tiers ne peut donc pas le faire accompagner une requête `POST`.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSpeakerSession();
  if (!session) {
    return NextResponse.json(
      { erreur: "Votre lien d'accès a expiré. Demandez-en un nouveau." },
      { status: 401 },
    );
  }

  const tropLourd = `Fichier trop lourd (maximum ${PRESENTATION_MAX_BYTES / 1024 / 1024} Mo).`;

  // Taille annoncée contrôlée avant lecture, puis taille réelle après : voir la
  // route des contributions pour le raisonnement.
  if (Number(request.headers.get("content-length") ?? 0) > PRESENTATION_MAX_BYTES) {
    return NextResponse.json({ erreur: tropLourd }, { status: 413 });
  }

  const octets = Buffer.from(await request.arrayBuffer());
  if (octets.length > PRESENTATION_MAX_BYTES) {
    return NextResponse.json({ erreur: tropLourd }, { status: 413 });
  }

  try {
    const { sessionsReliees } = await savePresentation(session.speakerId, octets);
    return NextResponse.json({ sessionsReliees });
  } catch (erreur) {
    if (erreur instanceof SpeakerRuleError) {
      return NextResponse.json({ erreur: erreur.message }, { status: 400 });
    }
    throw erreur;
  }
}
