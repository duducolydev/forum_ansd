import { describe, expect, it } from "vitest";
import { calculerPlaces, ETAT_LABELS, type EtatSession } from "./service";
import { sessionInputSchema, slugifier } from "./schema";

const MAINTENANT = new Date("2026-11-01T12:00:00.000Z");

function session(surcharge: Partial<Parameters<typeof calculerPlaces>[0]> = {}) {
  return {
    capacity: 100,
    registrationOpen: true,
    registrationDeadline: null,
    waitlistEnabled: true,
    ...surcharge,
  };
}

describe("places et état d'une session (brief §5.5)", () => {
  it("annonce une session ouverte tant qu'il reste de la place", () => {
    const places = calculerPlaces(session(), { inscrits: 40, attente: 0 }, MAINTENANT);
    expect(places).toMatchObject({ etat: "OUVERTE", restantes: 60 });
  });

  it("bascule en liste d'attente une fois la capacité atteinte", () => {
    const places = calculerPlaces(session(), { inscrits: 100, attente: 3 }, MAINTENANT);
    expect(places).toMatchObject({ etat: "LISTE_ATTENTE", restantes: 0, attente: 3 });
  });

  it("annonce complet quand la liste d'attente est désactivée", () => {
    const places = calculerPlaces(
      session({ waitlistEnabled: false }),
      { inscrits: 100, attente: 0 },
      MAINTENANT,
    );
    expect(places.etat).toBe("COMPLETE");
  });

  it("clôture après l'échéance, même s'il reste des places", () => {
    const places = calculerPlaces(
      session({ registrationDeadline: new Date("2026-10-31T23:59:59.000Z") }),
      { inscrits: 10, attente: 0 },
      MAINTENANT,
    );
    expect(places).toMatchObject({ etat: "CLOTUREE", restantes: 90 });
  });

  it("ne réserve pas de place à la réservation quand elle n'est pas ouverte", () => {
    const places = calculerPlaces(
      session({ registrationOpen: false }),
      { inscrits: 0, attente: 0 },
      MAINTENANT,
    );
    expect(places.etat).toBe("SANS_RESERVATION");
  });

  it("ne descend jamais sous zéro place restante", () => {
    // Une capacité réduite après coup laisse plus d'inscrits que de sièges :
    // afficher « -5 places » serait absurde, et un calcul négatif remonterait
    // ensuite dans la réservation.
    const places = calculerPlaces(session({ capacity: 10 }), { inscrits: 15, attente: 0 });
    expect(places.restantes).toBe(0);
    expect(places.etat).toBe("LISTE_ATTENTE");
  });

  it("laisse le compteur indéfini pour une session sans capacité", () => {
    const places = calculerPlaces(session({ capacity: null, registrationOpen: false }), {
      inscrits: 0,
      attente: 0,
    });
    expect(places.restantes).toBeNull();
  });

  /**
   * Le quota VIP réserve une partie des places à une population ; il ne réduit
   * pas la salle. L'afficher en moins ferait croire à des sièges manquants, et
   * la page publique divergerait de ce que la réservation autorise.
   */
  it("ne retranche pas le quota VIP du compteur affiché", () => {
    const places = calculerPlaces(session(), { inscrits: 0, attente: 0 }, MAINTENANT);
    expect(places.restantes).toBe(100);
  });

  it("a un libellé pour chaque état", () => {
    const etats: EtatSession[] = [
      "SANS_RESERVATION",
      "OUVERTE",
      "LISTE_ATTENTE",
      "COMPLETE",
      "CLOTUREE",
    ];
    for (const etat of etats) expect(ETAT_LABELS[etat]).toBeTruthy();
  });
});

describe("saisie d'une session", () => {
  const base = {
    type: "PANEL" as const,
    titleFr: "Panel 1 — Données",
    day: "2026-11-23",
    startTime: "09:00",
    endTime: "10:30",
    registrationOpen: false,
    waitlistEnabled: true,
    isPublished: false,
  };

  it("accepte une saisie minimale", () => {
    expect(sessionInputSchema.safeParse(base).success).toBe(true);
  });

  it("refuse une fin antérieure au début", () => {
    const resultat = sessionInputSchema.safeParse({ ...base, endTime: "08:00" });
    expect(resultat.success).toBe(false);
  });

  it("refuse une réservation ouverte sans capacité", () => {
    // Sans capacité, il n'y a pas de limite à faire respecter : la session
    // accepterait indéfiniment des inscrits pour une salle qui, elle, est finie.
    const resultat = sessionInputSchema.safeParse({ ...base, registrationOpen: true });
    expect(resultat.success).toBe(false);
  });

  it("refuse un quota VIP supérieur à la capacité", () => {
    const resultat = sessionInputSchema.safeParse({
      ...base,
      registrationOpen: true,
      capacity: 50,
      vipQuota: 80,
    });
    expect(resultat.success).toBe(false);
  });

  it("refuse une heure hors format", () => {
    expect(sessionInputSchema.safeParse({ ...base, startTime: "9h" }).success).toBe(false);
    expect(sessionInputSchema.safeParse({ ...base, startTime: "25:00" }).success).toBe(false);
  });
});

describe("slug dérivé du titre", () => {
  it("retire les accents et la ponctuation", () => {
    expect(slugifier("Panel 2 — Données climatiques & résilience")).toBe(
      "panel-2-donnees-climatiques-resilience",
    );
  });

  it("ne laisse ni tiret initial ni tiret final", () => {
    expect(slugifier("  — Clôture —  ")).toBe("cloture");
  });

  it("reste non vide pour un titre exotique", () => {
    expect(slugifier("«»")).toBe("");
  });
});
