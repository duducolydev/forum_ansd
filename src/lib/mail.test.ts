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

  // -------------------------------------------------------------------------
  // Bascule Mailjet (19 novembre 2026) : la détection ne peut plus être
  // gmail-centrée, sans quoi un refus de quota passerait pour une panne.
  // -------------------------------------------------------------------------

  it("reconnaît un plafond annoncé par un autre relais que Gmail", () => {
    expect(
      estRefusQuota(new Error("550 5.7.1 Daily sending limit exceeded for this account")),
    ).toBe(true);
    expect(estRefusQuota(new Error("450 4.2.1 Peak SMTP relay limit exceeded for customer"))).toBe(
      true,
    );
    expect(
      estRefusQuota(new Error("421 Monthly limit reached, upgrade your plan to continue")),
    ).toBe(true);
  });

  it("reconnaît un bridage de cadence", () => {
    expect(estRefusQuota(new Error("451 4.7.1 Message temporarily deferred: throttled"))).toBe(
      true,
    );
    expect(estRefusQuota(new Error("421 4.3.2 Service not available, closing channel"))).toBe(true);
  });

  it("ne prend pas la boîte pleine du destinataire pour notre quota", () => {
    // Le piège de l'élargissement : « over quota » désigne aussi la boîte du
    // destinataire. Différer six heures serait faux — ce n'est pas notre
    // plafond, et le message doit suivre le cours ordinaire d'un rebond.
    expect(estRefusQuota(new Error("552 5.2.2 Over quota: recipient mailbox is full"))).toBe(false);
    expect(estRefusQuota(new Error("550 5.1.10 Recipient user unknown"))).toBe(false);
  });
});

describe("adresse de réponse", () => {
  it("applique SMTP_REPLY_TO à la voie transactionnelle", () => {
    // Avec Mailjet, le `From` annonce forum26@ansd.sn : encore faut-il que
    // quelqu'un relève cette boîte. En attendant, les réponses sont renvoyées
    // vers une adresse réellement lue, sans toucher au `From`.
    const config = configBoite("transactionnel", { ...BASE, SMTP_REPLY_TO: "forumansd@gmail.com" });
    expect(config.replyTo).toBe("forumansd@gmail.com");
    expect(config.from).toBe(BASE.SMTP_FROM);
  });

  it("laisse la voie transactionnelle sans adresse de réponse par défaut", () => {
    expect(configBoite("transactionnel", BASE).replyTo).toBeUndefined();
  });

  it("fait passer SMTP_REPLY_TO avant la déduction de la campagne", () => {
    const config = configBoite("campagne", {
      ...BASE,
      SMTP_CAMPAGNE_USER: "forumansd.envois@gmail.com",
      SMTP_REPLY_TO: "contact@ansd.sn",
    });
    expect(config.replyTo).toBe("contact@ansd.sn");
  });
});

describe("configBoite — Mailjet", () => {
  const MAILJET = {
    SMTP_HOST: "in-v3.mailjet.com",
    SMTP_PORT: "587",
    SMTP_USER: "cle-api-mailjet",
    SMTP_PASSWORD: "cle-secrete-mailjet",
    SMTP_FROM: "Forum international sur les données <forum26@ansd.sn>",
  };

  it("garde l'adresse du domaine validé, sans la réécrire sur l'identifiant", () => {
    // La différence avec Gmail : l'identifiant est une clé d'API, pas une
    // adresse. Annoncer la clé en expéditeur n'aurait aucun sens.
    const config = configBoite("transactionnel", MAILJET);
    expect(config.host).toBe("in-v3.mailjet.com");
    expect(config.port).toBe(587);
    expect(config.from).toBe("Forum international sur les données <forum26@ansd.sn>");
  });

  it("fait tenir les deux voies sur un seul compte", () => {
    // Le réglage normal depuis la bascule : pas de SMTP_CAMPAGNE_*, un seul
    // plan souscrit, et le pool partagé évite de rouvrir deux connexions.
    expect(configBoite("campagne", MAILJET)).toEqual(configBoite("transactionnel", MAILJET));
  });
});
