import { describe, expect, it } from "vitest";
import { NAV_GROUPS } from "@/components/admin/nav";
import { PAGES_CAMERA, utiliseLaCamera } from "./pages-camera";

describe("pages qui utilisent la caméra", () => {
  it("reconnaît le scanner, ses sous-chemins et le comptoir d'accueil", () => {
    expect(utiliseLaCamera("/scan")).toBe(true);
    expect(utiliseLaCamera("/scan/hors-ligne")).toBe(true);
    expect(utiliseLaCamera("/admin/accueil")).toBe(true);
  });

  it("ne confond pas un simple préfixe de nom avec la page", () => {
    // `/scanner-public` commence par « /scan » sans être le scanner.
    expect(utiliseLaCamera("/scanner-public")).toBe(false);
    expect(utiliseLaCamera("/admin")).toBe(false);
    expect(utiliseLaCamera("/")).toBe(false);
  });

  it("correspond à des entrées réelles du menu", () => {
    // Si une page caméra quittait le menu ou changeait d'adresse, le lien à
    // rechargement complet ne s'appliquerait plus, sans que rien ne casse
    // visiblement : la caméra redeviendrait indisponible depuis le menu.
    const adresses = NAV_GROUPS.flatMap((groupe) => groupe.items).map((item) => item.href);
    for (const page of PAGES_CAMERA) {
      expect(adresses).toContain(page);
    }
  });
});
