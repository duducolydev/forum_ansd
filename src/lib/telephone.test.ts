import { describe, expect, it } from "vitest";
import { joindreTelephone, listeIndicatifs, separerTelephone } from "./telephone";

describe("indicatifs téléphoniques", () => {
  it("liste les pays par nom, avec leur indicatif", () => {
    const liste = listeIndicatifs("fr");
    const senegal = liste.find((indicatif) => indicatif.pays === "SN");
    expect(senegal).toMatchObject({ code: "221", nom: "Sénégal" });
    const noms = liste.map((indicatif) => indicatif.nom);
    expect(noms).toEqual([...noms].sort((a, b) => a.localeCompare(b, "fr")));
  });

  it("joint l'indicatif et le numéro", () => {
    expect(joindreTelephone("SN", "77 123 45 67")).toBe("+221 77 123 45 67");
    expect(joindreTelephone("FR", "6 12 34 56 78")).toBe("+33 6 12 34 56 78");
  });

  it("ne double pas un indicatif ressaisi dans le numéro", () => {
    expect(joindreTelephone("SN", "+221 77 123 45 67")).toBe("+221 77 123 45 67");
    expect(joindreTelephone("SN", "00221 77 123 45 67")).toBe("+221 77 123 45 67");
  });

  it("laisse vide un numéro vide", () => {
    expect(joindreTelephone("SN", "  ")).toBe("");
  });

  it("retrouve le pays et le numéro d'une valeur enregistrée", () => {
    expect(separerTelephone("+221 77 123 45 67")).toEqual({ pays: "SN", national: "77 123 45 67" });
    expect(separerTelephone("+33 6 12 34 56 78")).toEqual({
      pays: "FR",
      national: "6 12 34 56 78",
    });
    expect(separerTelephone("00223 76 00 00 00").pays).toBe("ML");
  });

  it("rattache au Sénégal un ancien numéro sans indicatif, sans le toucher", () => {
    expect(separerTelephone("77 123 45 67")).toEqual({ pays: "SN", national: "77 123 45 67" });
    expect(separerTelephone(null)).toEqual({ pays: "SN", national: "" });
  });

  it("fait l'aller-retour", () => {
    const { pays, national } = separerTelephone("+225 07 08 09 10 11");
    expect(joindreTelephone(pays, national)).toBe("+225 07 08 09 10 11");
  });
});
