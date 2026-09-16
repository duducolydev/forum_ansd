import { describe, expect, it } from "vitest";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS } from "./permissions";

describe("permissions catalog", () => {
  it("defines the 8 BackOffice roles from the brief (§12), plus the rapporteur", () => {
    /*
     * Le brief définit huit rôles. Le neuvième, RAPPORTEUR, a été ajouté sur
     * décision du commanditaire le 14 septembre 2026 (PLAN.md §15) : il rédige
     * des contributions sur les sessions auxquelles il est rattaché, sans les
     * publier. Il est listé à part pour que l'écart au brief reste visible.
     */
    expect(Object.keys(DEFAULT_ROLE_PERMISSIONS)).toEqual([
      "SUPER_ADMIN",
      "ADMIN_FORUM",
      "GESTIONNAIRE_PARTICIPANTS",
      "AGENT_ACCUEIL",
      "GESTIONNAIRE_PROGRAMME",
      "GESTIONNAIRE_COMMUNICATION",
      "GESTIONNAIRE_STATISTIQUES",
      "LECTEUR",
      "RAPPORTEUR",
    ]);
  });

  it("limits the rapporteur to drafting, without publication", () => {
    expect(DEFAULT_ROLE_PERMISSIONS.RAPPORTEUR).toEqual(["contributions.draft"]);
  });

  it("grants SUPER_ADMIN every permission in the catalog", () => {
    expect(DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN).toEqual(PERMISSIONS);
  });

  it("only assigns permissions that exist in the central catalog", () => {
    for (const [role, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      for (const permission of permissions) {
        expect(PERMISSIONS, `role ${role} references unknown permission ${permission}`).toContain(
          permission,
        );
      }
    }
  });

  it("excludes user/settings/edition management from ADMIN_FORUM (brief §12)", () => {
    expect(DEFAULT_ROLE_PERMISSIONS.ADMIN_FORUM).not.toContain("users.manage");
    expect(DEFAULT_ROLE_PERMISSIONS.ADMIN_FORUM).not.toContain("settings.write");
    expect(DEFAULT_ROLE_PERMISSIONS.ADMIN_FORUM).not.toContain("editions.manage");
  });
});
