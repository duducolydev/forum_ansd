import { describe, expect, it } from "vitest";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS } from "@/lib/permissions";
import { entreeActive, menuPour, NAV_GROUPS } from "./nav";

const toutesLesEntrees = NAV_GROUPS.flatMap((groupe) => groupe.items);

describe("menu du BackOffice", () => {
  it("n'exige que des permissions du catalogue", () => {
    // Une permission mal orthographiée ne casse rien : elle fait simplement
    // disparaître l'entrée pour tout le monde, sans un mot.
    for (const entree of toutesLesEntrees) {
      for (const permission of entree.permissions) {
        expect(PERMISSIONS, `${entree.href} : ${permission}`).toContain(permission);
      }
    }
  });

  it("n'annonce aucune adresse en double", () => {
    const adresses = toutesLesEntrees.map((entree) => entree.href);
    expect(new Set(adresses).size).toBe(adresses.length);
  });

  it("donne une icône à chaque entrée", () => {
    // Le menu réduit n'affiche que les icônes : une entrée sans icône y
    // deviendrait une case vide, impossible à identifier.
    for (const entree of toutesLesEntrees) {
      expect(entree.icone, entree.href).toBeTruthy();
    }
  });

  it("désigne l'entrée active par le préfixe le plus long", () => {
    // `/admin` est préfixe de tout : sans cette règle, le tableau de bord
    // resterait surligné sur chaque écran.
    expect(entreeActive("/admin")?.href).toBe("/admin");
    expect(entreeActive("/admin/participants")?.href).toBe("/admin/participants");
    expect(entreeActive("/admin/participants/abc123")?.href).toBe("/admin/participants");
    expect(entreeActive("/admin/parametres/roles")?.href).toBe("/admin/parametres");
    expect(entreeActive("/connexion")).toBeUndefined();
  });

  it("montre tout au super administrateur", () => {
    const visibles = menuPour(DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN!).flatMap(
      (groupe) => groupe.items,
    );
    expect(visibles).toHaveLength(toutesLesEntrees.length);
  });

  it("cache Utilisateurs à l'administrateur Forum, mais lui laisse le journal", () => {
    /*
     * Le §12 ne retire à ce rôle que `users.manage`, `settings.write` et
     * `editions.manage` : il conserve `audit.read`. La distinction est
     * volontaire — conduire le Forum suppose de pouvoir relire ce qui s'est
     * passé, pas de distribuer les accès.
     */
    const adresses = menuPour(DEFAULT_ROLE_PERMISSIONS.ADMIN_FORUM!)
      .flatMap((groupe) => groupe.items)
      .map((entree) => entree.href);

    expect(adresses).not.toContain("/admin/utilisateurs");
    expect(adresses).toContain("/admin/audit");
    expect(adresses).toContain("/admin/sponsors");
  });

  it("ne laisse au lecteur que ce qu'il peut ouvrir", () => {
    const adresses = menuPour(DEFAULT_ROLE_PERMISSIONS.LECTEUR!)
      .flatMap((groupe) => groupe.items)
      .map((entree) => entree.href);

    expect(adresses).toContain("/admin/participants");
    expect(adresses).not.toContain("/admin/utilisateurs");
    expect(adresses).not.toContain("/admin/sponsors");
    // Le comptoir d'accueil exige deux permissions : en détenir une seule ne suffit pas.
    expect(adresses).not.toContain("/admin/accueil");
  });

  it("ouvre Contributions au gestionnaire programme comme au rapporteur", () => {
    /*
     * L'entrée demande l'une **ou** l'autre permission : le gestionnaire gère
     * toutes les sessions, le rapporteur les siennes, et aucun rôle ne détient
     * les deux. Exiger les deux, comme le font les autres entrées, l'aurait
     * cachée à tout le monde sauf aux administrateurs.
     */
    const adressesDe = (role: string) =>
      menuPour(DEFAULT_ROLE_PERMISSIONS[role]!)
        .flatMap((groupe) => groupe.items)
        .map((entree) => entree.href);

    expect(adressesDe("GESTIONNAIRE_PROGRAMME")).toContain("/admin/contributions");
    expect(adressesDe("RAPPORTEUR")).toEqual(["/admin/contributions"]);
    expect(adressesDe("LECTEUR")).not.toContain("/admin/contributions");
  });

  it("ne montre rien à un rôle sans permission", () => {
    expect(menuPour([])).toHaveLength(0);
  });
});
