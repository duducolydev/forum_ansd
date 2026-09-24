import { describe, expect, it } from "vitest";
import { PERMISSIONS } from "@/lib/permissions";
import { CATALOGUE, permissionsSansLibelle } from "./permissions-catalogue";

/**
 * Le catalogue est ce qui rend une permission **accordable**.
 *
 * L'en-tête de `permissions-catalogue.ts` annonçait ce test depuis le début ;
 * il n'existait pas. La page des rôles affichait bien un bandeau pour les
 * permissions orphelines, mais il fallait ouvrir cet écran pour le voir —
 * `hotels.manage` y est resté invisible le temps d'un chantier entier.
 */
describe("catalogue des permissions", () => {
  it("nomme toutes les permissions du catalogue central", () => {
    expect(permissionsSansLibelle()).toEqual([]);
  });

  it("ne déclare aucune permission inconnue", () => {
    const declarees = CATALOGUE.flatMap((groupe) =>
      groupe.permissions.map((permission) => permission.cle),
    );
    const inconnues = declarees.filter((cle) => !(PERMISSIONS as readonly string[]).includes(cle));
    expect(inconnues).toEqual([]);
  });

  it("ne nomme pas deux fois la même permission", () => {
    const declarees = CATALOGUE.flatMap((groupe) =>
      groupe.permissions.map((permission) => permission.cle),
    );
    expect(declarees.length).toBe(new Set(declarees).size);
  });
});
