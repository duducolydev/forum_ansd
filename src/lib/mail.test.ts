import { describe, expect, it } from "vitest";
import { configBoite, estRefusQuota } from "./mail";

const BASE = {
  SMTP_HOST: "smtp.gmail.com",
  SMTP_PORT: "587",
  SMTP_USER: "forumansd@gmail.com",
  SMTP_PASSWORD: "secret-transac",
  SMTP_FROM: "Forum international sur les données <forumansd@gmail.com>",
};

describe("configBoite", () => {
  it("rend la boîte historique pour la voie transactionnelle", () => {
    const config = configBoite("transactionnel", BASE);
    expect(config.user).toBe("forumansd@gmail.com");
    expect(config.from).toBe(BASE.SMTP_FROM);
    expect(config.port).toBe(587);
  });

  it("retombe sur la boîte historique tant que la seconde n'est pas déclarée", () => {
    // Le cas du développement (Mailpit) et d'un déploiement pas encore migré :
    // rien ne doit changer pour eux.
    expect(configBoite("campagne", BASE)).toEqual(configBoite("transactionnel", BASE));
  });

  it("déclare la boîte de campagne à partir du seul identifiant", () => {
    const config = configBoite("campagne", {
      ...BASE,
      SMTP_CAMPAGNE_USER: "forumansd.envois@gmail.com",
      SMTP_CAMPAGNE_PASSWORD: "secret-campagne",
    });
    // Même fournisseur : l'hôte est repris, seul le compte change.
    expect(config.host).toBe("smtp.gmail.com");
    expect(config.user).toBe("forumansd.envois@gmail.com");
    expect(config.pass).toBe("secret-campagne");
  });

  it("garde le nom affiché du Forum sur l'adresse de campagne", () => {
    // Gmail réécrit le `From` avec l'adresse authentifiée : l'adresse doit être
    // celle du compte de campagne, mais le participant doit lire le même nom.
    const config = configBoite("campagne", {
      ...BASE,
      SMTP_CAMPAGNE_USER: "forumansd.envois@gmail.com",
    });
    expect(config.from).toBe("Forum international sur les données <forumansd.envois@gmail.com>");
  });

  it("renvoie les réponses d'une campagne vers la boîte que l'équipe relève", () => {
    const config = configBoite("campagne", {
      ...BASE,
      SMTP_CAMPAGNE_USER: "forumansd.envois@gmail.com",
    });
    expect(config.replyTo).toBe("forumansd@gmail.com");
  });

  it("ne prend pas une variable vide pour un port (le défaut du 18 novembre 2026)", () => {
    // Compose écrit `${SMTP_CAMPAGNE_PORT:-}` : la variable arrive **vide**,
    // pas absente. `??` la laissait passer et `Number("")` donnait 0 — relevé
    // en production, où la boîte de campagne s'annonçait « smtp.gmail.com:0 ».
    const config = configBoite("campagne", {
      ...BASE,
      SMTP_CAMPAGNE_USER: "forum20.ansd@gmail.com",
      SMTP_CAMPAGNE_PORT: "",
      SMTP_CAMPAGNE_HOST: "",
      SMTP_CAMPAGNE_FROM: "",
    });
    expect(config.port).toBe(587);
    expect(config.host).toBe("smtp.gmail.com");
    expect(config.from).toBe("Forum international sur les données <forum20.ansd@gmail.com>");
  });

  it("retombe sur 587 quand aucun port n'est renseigné nulle part", () => {
    expect(configBoite("transactionnel", { SMTP_HOST: "smtp.gmail.com", SMTP_PORT: "" }).port).toBe(
      587,
    );
  });

  it("accepte un fournisseur différent pour les campagnes", () => {
    const config = configBoite("campagne", {
      ...BASE,
      SMTP_CAMPAGNE_HOST: "smtp-relay.brevo.com",
      SMTP_CAMPAGNE_PORT: "2525",
      SMTP_CAMPAGNE_USER: "envois@ansd.sn",
      SMTP_CAMPAGNE_FROM: "Forum ANSD <envois@ansd.sn>",
    });
    expect(config.host).toBe("smtp-relay.brevo.com");
    expect(config.port).toBe(2525);
    expect(config.from).toBe("Forum ANSD <envois@ansd.sn>");
  });
});

describe("estRefusQuota", () => {
  it("reconnaît le quota journalier de Gmail", () => {
    // Le message exact du 18 novembre 2026.
    expect(
      estRefusQuota(
        new Error(
          "Data command failed: 550-5.4.5 Daily user sending limit exceeded. For more " +
            "information on Gmail 550-5.4.5 sending limits go to 550 5.4.5 " +
            "https://support.google.com/a/answer/166852",
        ),
      ),
    ).toBe(true);
  });

  it("reconnaît le quota de connexions du 17 novembre", () => {
    expect(
      estRefusQuota(new Error("454-4.7.0 Too many login attempts, please try again later")),
    ).toBe(true);
  });

  it("ne confond pas une panne ordinaire avec un quota", () => {
    expect(estRefusQuota(new Error("connect ECONNREFUSED 127.0.0.1:587"))).toBe(false);
    // Un rebond dur : l'adresse n'existe pas. Rien à voir avec le quota, et
    // surtout rien à différer — le réessai échouerait à l'identique.
    expect(estRefusQuota(new Error("550-5.1.1 The email account that you tried to reach"))).toBe(
      false,
    );
  });
});
