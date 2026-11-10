import { describe, expect, it } from "vitest";
import { analyserAvis, decoderMotsEncodes, lireRapport, motifRebond } from "./avis-rebond";
import { configImap } from "./rebonds";

/** Avis Gmail pour une adresse Yahoo inexistante, tel qu'il arrive dans la boîte du Forum. */
const EN_TETES = [
  "Delivered-To: forumansd@gmail.com",
  "Return-Path: <>",
  "From: Mail Delivery Subsystem <mailer-daemon@googlemail.com>",
  "To: forumansd@gmail.com",
  "Subject: Delivery Status Notification (Failure)",
  "Message-ID: <avis-1@mx.google.com>",
  "Date: Tue, 10 Nov 2026 08:57:12 +0000",
  'Content-Type: multipart/report; boundary="000";',
  "\treport-type=delivery-status",
  "",
].join("\r\n");

const RAPPORT = [
  "Reporting-MTA: dns; googlemail.com",
  "Arrival-Date: Tue, 10 Nov 2026 00:57:09 -0800 (PST)",
  "X-Original-Message-ID: <envoi-42@gmail.com>",
  "",
  "Final-Recipient: rfc822; Astoubobo_Sagna@yahoo.fr",
  "Action: failed",
  "Status: 5.0.0",
  "Remote-MTA: dns; mx-eu.mail.am0.yahoodns.net. (188.125.72.73, the server for the domain yahoo.fr.)",
  "Diagnostic-Code: smtp; 554 delivery error: dd This user doesn't have a yahoo.fr",
  " account (astoubobo_sagna@yahoo.fr) [0] - mta1012.mail.ir2.yahoo.com",
  "Last-Attempt-Date: Tue, 10 Nov 2026 00:57:12 -0800 (PST)",
  "",
].join("\r\n");

const ORIGINAL = [
  "From: Forum international sur les données <forumansd@gmail.com>",
  "To: astoubobo_sagna@yahoo.fr",
  "Subject: =?UTF-8?Q?Vous_=C3=AAtes_invit=C3=A9(e)_au_Forum?=",
  " =?UTF-8?Q?_international_sur_les_donn=C3=A9es?=",
  "Message-ID: <envoi-42@gmail.com>",
  "Date: Tue, 10 Nov 2026 08:57:08 +0000",
  "",
].join("\r\n");

describe("analyserAvis", () => {
  it("retrouve l'adresse refusée, l'envoi d'origine et l'objet décodé", () => {
    const avis = analyserAvis({ enTetes: EN_TETES, rapport: RAPPORT, original: ORIGINAL });
    expect(avis).not.toBeNull();
    expect(avis!.messageId).toBe("<avis-1@mx.google.com>");
    expect(avis!.date?.toISOString()).toBe("2026-11-10T08:57:12.000Z");
    expect(avis!.original.messageId).toBe("<envoi-42@gmail.com>");
    expect(avis!.original.sujet).toBe("Vous êtes invité(e) au Forum international sur les données");
    expect(avis!.echecs).toEqual([
      {
        adresse: "astoubobo_sagna@yahoo.fr",
        statut: "5.0.0",
        diagnostic:
          "554 delivery error: dd This user doesn't have a yahoo.fr account (astoubobo_sagna@yahoo.fr) [0] - mta1012.mail.ir2.yahoo.com",
      },
    ]);
  });

  it("se rabat sur X-Original-Message-ID quand la copie d'origine manque", () => {
    const avis = analyserAvis({ enTetes: EN_TETES, rapport: RAPPORT, original: null });
    expect(avis!.original.messageId).toBe("<envoi-42@gmail.com>");
    expect(avis!.original.sujet).toBeNull();
  });

  it("ignore un retard de distribution : Gmail réessaie encore", () => {
    const retard = RAPPORT.replace("Action: failed", "Action: delayed").replace(
      "Status: 5.0.0",
      "Status: 4.4.1",
    );
    expect(analyserAvis({ enTetes: EN_TETES, rapport: retard })).toBeNull();
  });
});

describe("lireRapport", () => {
  it("ne garde que les destinataires définitivement refusés", () => {
    const rapport = [
      "Reporting-MTA: dns; exemple.sn",
      "",
      "Final-Recipient: rfc822; bon@exemple.sn",
      "Action: delivered",
      "Status: 2.0.0",
      "",
      "Final-Recipient: rfc822; <faux@exemple.sn>",
      "Action: failed",
      "Status: 5.1.1",
    ].join("\n");
    expect(lireRapport(rapport)).toEqual([
      { adresse: "faux@exemple.sn", statut: "5.1.1", diagnostic: null },
    ]);
  });
});

describe("motifRebond", () => {
  it("lit « adresse introuvable » dans le diagnostic quand le code est générique", () => {
    expect(
      motifRebond({
        adresse: "x@yahoo.fr",
        statut: "5.0.0",
        diagnostic: "554 delivery error: dd This user doesn't have a yahoo.fr account",
      }),
    ).toMatch(/^Adresse introuvable \(5\.0\.0\)/);
  });

  it("traduit les codes étendus courants", () => {
    expect(motifRebond({ adresse: "a@b.sn", statut: "5.1.1", diagnostic: null })).toBe(
      "Adresse introuvable (5.1.1)",
    );
    expect(motifRebond({ adresse: "a@b.sn", statut: "5.2.2", diagnostic: null })).toBe(
      "Boîte aux lettres pleine (5.2.2)",
    );
    expect(motifRebond({ adresse: "a@b.sn", statut: "5.4.4", diagnostic: null })).toBe(
      "Domaine introuvable (5.4.4)",
    );
  });
});

describe("decoderMotsEncodes", () => {
  it("décode le base64 et le quoted-printable", () => {
    expect(decoderMotsEncodes("=?UTF-8?B?Qm9uam91ciDDqXTDqQ==?=")).toBe("Bonjour été");
    expect(decoderMotsEncodes("=?ISO-8859-1?Q?r=E9ponse?=")).toBe("réponse");
  });
});

describe("configImap", () => {
  it("déduit imap.gmail.com du SMTP Gmail, avec le même compte", () => {
    expect(
      configImap({
        SMTP_HOST: "smtp.gmail.com",
        SMTP_USER: "forumansd@gmail.com",
        SMTP_PASSWORD: "secret",
      }),
    ).toEqual({ host: "imap.gmail.com", port: 993, user: "forumansd@gmail.com", pass: "secret" });
  });

  it("reste inactif sans IMAP ni Gmail (Mailpit en développement)", () => {
    expect(configImap({ SMTP_HOST: "localhost", SMTP_USER: "", SMTP_PASSWORD: "" })).toBeNull();
  });
});
