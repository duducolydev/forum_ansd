import { describe, expect, it } from "vitest";
import { debutJour, planifierEnvoi, RepartitionImpossible, type CompteEnvoi } from "./repartition";

const DEPART = new Date("2026-11-25T10:00:00.000Z");

function compte(boite: CompteEnvoi["boite"], plafond: number, dejaUtilise = 0): CompteEnvoi {
  return { cle: `cle-${boite}`, boite, adresse: `${boite}@exemple.sn`, plafond, dejaUtilise };
}

describe("planifierEnvoi", () => {
  it("répartit à tour de rôle entre les comptes, chacun à sa cadence", () => {
    const plan = planifierEnvoi(4, [compte("campagne", 400), compte("acces", 400)], DEPART, {
      envoisParMinute: 20,
    });

    expect(plan.affectations.map((a) => a.boite)).toEqual([
      "campagne",
      "acces",
      "campagne",
      "acces",
    ]);
    // Deux comptes en parallèle : le troisième destinataire part 3 s après le premier.
    expect(plan.affectations[2]!.runAt.getTime() - DEPART.getTime()).toBe(3000);
    expect(plan.jours).toBe(1);
  });

  it("déduit ce que chaque compte a déjà envoyé, et reporte le surplus au lendemain", () => {
    const plan = planifierEnvoi(
      1000,
      [compte("campagne", 400, 350), compte("acces", 400), compte("participation", 400)],
      DEPART,
      { envoisParMinute: 20 },
    );

    const jour0 = plan.lots.filter((lot) => lot.jour === 0);
    expect(jour0.map((lot) => [lot.boite, lot.nombre])).toEqual([
      ["campagne", 50],
      ["acces", 400],
      ["participation", 400],
    ]);
    const jour1 = plan.lots.filter((lot) => lot.jour === 1);
    expect(jour1.reduce((total, lot) => total + lot.nombre, 0)).toBe(150);
    expect(plan.jours).toBe(2);
    expect(plan.affectations).toHaveLength(1000);
    // Le lendemain part après la fenêtre glissante de 24 h.
    expect(new Date(jour1[0]!.debut).getTime()).toBe(debutJour(DEPART, 1).getTime());
    expect(debutJour(DEPART, 1).getTime() - DEPART.getTime()).toBeGreaterThan(24 * 3600_000);
  });

  it("ne compte qu'une fois deux boîtes sur le même compte", () => {
    const partage = { ...compte("inscription", 160), cle: "cle-transactionnel" };
    const plan = planifierEnvoi(300, [compte("transactionnel", 160), partage], DEPART, {
      envoisParMinute: 20,
    });
    expect(plan.lots.filter((lot) => lot.jour === 0)).toHaveLength(1);
    expect(plan.jours).toBe(2);
  });

  it("tient compte des envois déjà programmés par une autre newsletter", () => {
    const plan = planifierEnvoi(100, [compte("campagne", 400)], DEPART, {
      envoisParMinute: 20,
      reservations: [{ cle: "cle-campagne", debut: DEPART, nombre: 350 }],
    });
    expect(plan.lots[0]!.nombre).toBe(50);
    expect(plan.jours).toBe(2);
  });

  it("refuse sans boîte, ou quand l'envoi s'étalerait trop", () => {
    expect(() => planifierEnvoi(10, [], DEPART, { envoisParMinute: 20 })).toThrow(
      RepartitionImpossible,
    );
    expect(() =>
      planifierEnvoi(10_000, [compte("campagne", 100)], DEPART, {
        envoisParMinute: 20,
        joursMax: 5,
      }),
    ).toThrow(RepartitionImpossible);
  });

  it("ne fait rien pour zéro destinataire", () => {
    expect(planifierEnvoi(0, [], DEPART, { envoisParMinute: 20 }).affectations).toEqual([]);
  });
});
