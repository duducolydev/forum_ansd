import { describe, expect, it } from "vitest";
import { originePhotoIntervenant, photoIntervenant } from "./photo";

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
