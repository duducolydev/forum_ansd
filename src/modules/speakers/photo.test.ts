import { describe, expect, it } from "vitest";
import { originePhotoIntervenant, photoIntervenant, urlPhotoIntervenant } from "./photo";

/** Photo des cartes d'intervenants : celle de la fiche, sinon celle du participant. */
describe("photo d'un intervenant", () => {
  it("préfère la photo de la fiche intervenant", () => {
    const speaker = {
      photoPath: "speakers/a.jpg",
      participant: { photoPath: "participants/b.jpg" },
    };
    expect(photoIntervenant(speaker)).toBe("speakers/a.jpg");
    expect(originePhotoIntervenant(speaker)).toBe("fiche");
  });

  it("reprend celle du participant lié quand la fiche n'en a pas", () => {
    const speaker = { photoPath: null, participant: { photoPath: "participants/b.jpg" } };
    expect(photoIntervenant(speaker)).toBe("participants/b.jpg");
    expect(originePhotoIntervenant(speaker)).toBe("participant");
  });

  it("n'en donne aucune sans fiche photo ni participant", () => {
    expect(photoIntervenant({ photoPath: null, participant: null })).toBeNull();
    expect(photoIntervenant({ photoPath: "" })).toBeNull();
    expect(originePhotoIntervenant({ photoPath: null })).toBeNull();
  });
});

describe("adresse de la photo d'un intervenant", () => {
  it("change avec le fichier, pour qu'une photo remplacée s'affiche tout de suite", () => {
    expect(urlPhotoIntervenant({ id: "s1", photoPath: "speakers/s1-a1b2c3d4e5f6.jpg" })).toBe(
      "/api/v1/speakers/s1/photo?v=a1b2c3d4e5f6",
    );
  });

  it("n'expose pas le chemin de stockage, qui porte l'identifiant public du badge", () => {
    const url = urlPhotoIntervenant({
      id: "s1",
      photoPath: null,
      participant: { photoPath: "photos/FID26-7K3M2P-a1b2c3d4e5f6.jpg" },
    });
    expect(url).toBe("/api/v1/speakers/s1/photo?v=a1b2c3d4e5f6");
    expect(url).not.toContain("FID26");
  });

  it("n'en donne aucune sans photo", () => {
    expect(urlPhotoIntervenant({ id: "s1", photoPath: null })).toBeNull();
  });
});
