import { describe, expect, it } from "vitest";
import { baliserLiens, corpsCourriel, gabaritCourriel, lienSur, resumeCourriel } from "./courriel";

/**
 * Mise en forme des courriels.
 *
 * Ces règles décident de ce que reçoivent des milliers de personnes, sur des
 * clients de messagerie qu'on ne peut pas tous essayer. Elles se testent donc
 * sur le HTML produit, qui est la seule chose dont on soit maître.
 */

const PIED = {
  organisation: "Agence nationale de la Statistique et de la Démographie (ANSD)",
  edition: "Forum international sur les données",
  quand: "23–25 novembre 2026 · Hôtel King Fahd Palace, Dakar",
};

const gabarit = (corps: string) =>
  gabaritCourriel({
    corps: corpsCourriel(corps),
    langue: "fr",
    baseUrl: "https://forum2026.ansd.sn",
    pied: PIED,
  });

describe("liens et boutons", () => {
  it("fait un bouton d'un lien nommé en fin de ligne", () => {
    const html = corpsCourriel(
      "Votre espace vous attend : [Accéder à mon espace](https://x.test/e)",
    );
    expect(html).toContain('href="https://x.test/e"');
    expect(html).toContain("Accéder à mon espace");
    // La phrase reste, sans le deux-points que le bouton rend inutile.
    expect(html).toContain(">Votre espace vous attend</p>");
  });

  it("fait un bouton d'une adresse nue en fin de ligne", () => {
    // Le cas des modèles déjà en base, qu'on ne peut pas réécrire depuis le code.
    const html = corpsCourriel("Confirmez votre inscription : https://x.test/i");
    expect(html).toContain('href="https://x.test/i"');
    expect(html).toContain(">Confirmez votre inscription</p>");
  });

  it("laisse en ligne un lien au milieu d'une phrase", () => {
    const html = corpsCourriel("Voir [le programme](https://x.test/p) avant de venir.");
    expect(html).toContain("text-decoration:underline");
    expect(html).toContain("avant de venir.");
    // Un lien au fil du texte ne doit pas couper la phrase en deux paragraphes.
    expect(html.match(/<p /g)).toHaveLength(1);
  });

  it("ne met en plein que le premier bouton", () => {
    // Deux aplats verts côte à côte ne désignent plus d'action principale.
    const html = corpsCourriel("Le détail : https://x.test/a\nVos réservations : https://x.test/b");
    expect(html.match(/bgcolor="#237033"/g)).toHaveLength(1);
    expect(html.match(/bgcolor="#ffffff"/g)).toHaveLength(1);
  });

  it("refuse un protocole exécutable et le laisse en texte", () => {
    expect(lienSur("javascript:alert(1)")).toBeNull();
    expect(lienSur("data:text/html,<script>")).toBeNull();
    expect(lienSur("https://x.test/ok")).toBe("https://x.test/ok");
  });

  it("échappe une étiquette de lien hostile", () => {
    const html = corpsCourriel("[<script>x</script>](https://x.test/a)");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("nommage des liens avant interpolation", () => {
  it("nomme les variables de lien connues", () => {
    const balisees = baliserLiens({ lien_espace: "https://x.test/e" }, "fr");
    expect(balisees.lien_espace).toBe("[Accéder à mon espace](https://x.test/e)");
  });

  it("traduit le libellé", () => {
    expect(baliserLiens({ lien_direct: "https://x.test/d" }, "en").lien_direct).toBe(
      "[Watch the Forum live](https://x.test/d)",
    );
  });

  it("laisse intacte une variable de lien vide", () => {
    // `referent_bloc` et consorts arrivent vides : pas de bouton vers nulle part.
    expect(baliserLiens({ lien_espace: "" }, "fr").lien_espace).toBe("");
  });

  it("ne touche pas aux variables qui ne portent pas de lien", () => {
    expect(baliserLiens({ prenom: "Awa", code6: "123456" }, "fr")).toEqual({
      prenom: "Awa",
      code6: "123456",
    });
  });

  it("laisse intacte une variable de lien dont la valeur n'est pas une adresse", () => {
    expect(baliserLiens({ lien_espace: "à venir" }, "fr").lien_espace).toBe("à venir");
  });
});

describe("résumé affiché dans la boîte de réception", () => {
  it("passe la salutation, qui est la même pour tout le monde", () => {
    expect(resumeCourriel("Bonjour Aminata,\n\nVotre badge est prêt.")).toBe(
      "Votre badge est prêt.",
    );
  });

  it("reconnaît la salutation dans les trois langues", () => {
    expect(resumeCourriel("Hello Awa,\n\nYour badge is ready.")).toBe("Your badge is ready.");
    expect(resumeCourriel("Olá Awa,\n\nO seu crachá está pronto.")).toBe(
      "O seu crachá está pronto.",
    );
  });

  it("retire les adresses, illisibles dans un aperçu tronqué", () => {
    expect(resumeCourriel("Bonjour,\n\nVotre espace : https://x.test/espace")).toBe(
      "Votre espace :",
    );
    expect(resumeCourriel("Bonjour,\n\nVoir [le programme](https://x.test/p) ici.")).toBe(
      "Voir le programme ici.",
    );
  });

  it("tronque proprement une longue première phrase", () => {
    const resume = resumeCourriel(`Bonjour,\n\n${"a".repeat(300)}`, 40);
    expect(resume).toHaveLength(40);
    expect(resume.endsWith("…")).toBe(true);
  });

  it("rend une chaîne vide plutôt que d'inventer, si le corps n'a que la salutation", () => {
    expect(resumeCourriel("Bonjour Aminata,")).toBe("");
  });
});

describe("gabarit", () => {
  it("porte les deux logos avec un texte de remplacement", () => {
    // Les messageries d'entreprise bloquent les images : le message doit
    // rester compréhensible sans elles.
    const html = gabarit("Bonjour.");
    expect(html).toContain("/images/logo_forum_badge.png");
    expect(html).toContain("/images/LOGO-ANSD-20ans-transparent.png");
    expect(html).toContain('alt="Forum international sur les données"');
    expect(html).toContain('alt="ANSD — 20 ans"');
  });

  it("n'emploie ni WebP, ni flexbox, ni variable CSS", () => {
    // Outlook rend le HTML avec le moteur de Word : aucun des trois n'y existe.
    const html = gabarit("Bonjour.");
    expect(html).not.toContain(".webp");
    expect(html).not.toContain("display:flex");
    expect(html).not.toContain("var(--");
  });

  it("reste largement sous le seuil de troncature de Gmail", () => {
    // Gmail coupe au-delà d'une centaine de kilo-octets et affiche « Message
    // tronqué » — ce qui emporterait la signature, et parfois le bouton.
    expect(Buffer.byteLength(gabarit("Bonjour."), "utf8")).toBeLessThan(12_000);
  });

  it("signe avec l'édition et son lieu", () => {
    const html = gabarit("Bonjour.");
    expect(html).toContain("Forum international sur les données");
    expect(html).toContain("Hôtel King Fahd Palace, Dakar");
  });

  it("échappe le pied de page", () => {
    const html = gabaritCourriel({
      corps: "<p>x</p>",
      langue: "fr",
      baseUrl: "https://forum2026.ansd.sn",
      pied: { ...PIED, edition: '<img src=x onerror="alert(1)">' },
    });
    // La balise ne doit pas exister ; son texte échappé, si.
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });
});
