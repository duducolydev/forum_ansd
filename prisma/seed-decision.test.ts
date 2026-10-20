import { describe, expect, it } from "vitest";
import { decisionSeed } from "./seed-decision";

function decider(baseInitialisee: boolean, demoDemandee: boolean, production: boolean) {
  return decisionSeed({ baseInitialisee, demoDemandee, production });
}

describe("decisionSeed", () => {
  it("n'écrit rien sur une base déjà initialisée", () => {
    expect(decider(true, false, true).action).toBe("rien");
    expect(decider(true, false, false).action).toBe("rien");
    expect(decider(true, true, false).action).toBe("rien");
  });

  it("refuse la démonstration en production, base vide ou non", () => {
    expect(decider(true, true, true).action).toBe("refus");
    expect(decider(false, true, true).action).toBe("refus");
  });

  it("initialise une base vide, avec la démonstration seulement si elle est demandée", () => {
    expect(decider(false, false, true)).toEqual({ action: "initialiser", demo: false });
    expect(decider(false, false, false)).toEqual({ action: "initialiser", demo: false });
    expect(decider(false, true, false)).toEqual({ action: "initialiser", demo: true });
  });

  it("ne propose pas de vider la base en production", () => {
    const decision = decider(true, false, true);
    expect(decision.action === "rien" && decision.message).not.toContain("migrate reset");
  });
});
