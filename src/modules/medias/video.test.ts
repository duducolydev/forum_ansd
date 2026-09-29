import { describe, expect, it } from "vitest";
import { lireLienVideo, urlLecteur, urlPageVideo, vignetteFournisseur } from "./video";

describe("liens vidéo de la médiathèque", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s", "dQw4w9WgXcQ"],
    ["https://m.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?si=abc", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/live/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ])("reconnaît YouTube : %s", (lien, identifiant) => {
    expect(lireLienVideo(lien)).toEqual({ fournisseur: "youtube", identifiant });
  });

  it.each([
    ["https://vimeo.com/76979871", "76979871"],
    ["https://vimeo.com/channels/staffpicks/76979871", "76979871"],
    ["https://player.vimeo.com/video/76979871?h=abc", "76979871"],
  ])("reconnaît Vimeo : %s", (lien, identifiant) => {
    expect(lireLienVideo(lien)).toEqual({ fournisseur: "vimeo", identifiant });
  });

  it.each([
    "pas une adresse",
    "https://exemple.org/video.mp4",
    "https://www.youtube.com/watch?v=trop-court",
    "javascript:alert(1)",
    "https://youtube.com.evil.org/watch?v=dQw4w9WgXcQ",
    "https://vimeo.com/abc",
  ])("refuse : %s", (lien) => {
    expect(lireLienVideo(lien)).toBeNull();
  });

  it("construit le lecteur « sans cookie » et refuse un identifiant altéré en base", () => {
    expect(urlLecteur("youtube", "dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0",
    );
    expect(urlLecteur("vimeo", "76979871")).toContain("player.vimeo.com/video/76979871");
    expect(urlLecteur("youtube", '"><script>')).toBeNull();
    expect(urlLecteur("dailymotion", "x7tgad0")).toBeNull();
    expect(urlPageVideo("vimeo", "76979871")).toBe("https://vimeo.com/76979871");
    expect(vignetteFournisseur("youtube", "dQw4w9WgXcQ")).toBe(
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    );
    expect(vignetteFournisseur("vimeo", "76979871")).toBeNull();
  });
});
