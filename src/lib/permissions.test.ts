import { describe, expect, it } from "vitest";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS } from "./permissions";

describe("permissions catalog", () => {
  it("defines the 8 BackOffice roles from the brief (§12), plus two added since", () => {
    /*
     * Le brief définit huit rôles. Deux s'y sont ajoutés, chacun sur décision
     * du commanditaire, et la liste est figée ici pour que l'écart au brief
     * reste visible plutôt que de se diluer au fil des ajouts :
     *
     * - RAPPORTEUR, le 14 septembre 2026 (PLAN.md §15) : rédige des
     *   contributions sur les sessions auxquelles il est rattaché, sans les
     *   publier ;
     * - GESTIONNAIRE_HOTELS, le 24 septembre 2026 (§29) : tient l'hébergement
     *   et les informations pratiques, et rien d'autre.
     */
    expect(Object.keys(DEFAULT_ROLE_PERMISSIONS)).toEqual([
      "SUPER_ADMIN",
      "ADMIN_FORUM",
      "GESTIONNAIRE_PARTICIPANTS",
      "AGENT_ACCUEIL",
      "GESTIONNAIRE_PROGRAMME",
      "GESTIONNAIRE_COMMUNICATION",
      "GESTIONNAIRE_STATISTIQUES",
      "GESTIONNAIRE_HOTELS",
      "LECTEUR",
      "RAPPORTEUR",
    ]);
  });

  it("limits the hotel manager to practical information", () => {
    /*
     * Le garde-fou de ce rôle : il ne doit **pas** recevoir `content.write`,
     * qui ouvre tout l'éditorial du site. Il négocie des tarifs, il n'a pas à
     * pouvoir réécrire la page d'accueil ni les mentions légales.
     */
    expect(DEFAULT_ROLE_PERMISSIONS.GESTIONNAIRE_HOTELS).toEqual(["hotels.manage", "content.read"]);
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
