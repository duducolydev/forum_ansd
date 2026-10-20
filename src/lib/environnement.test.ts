import { describe, expect, it } from "vitest";
import { estProduction } from "./environnement";

describe("estProduction", () => {
  it("reconnaît APP_ENV=production, quelle que soit la casse", () => {
    expect(estProduction({ APP_ENV: "production" })).toBe(true);
    expect(estProduction({ APP_ENV: " Production " })).toBe(true);
  });

  it("reconnaît une adresse publique sur le domaine de l'ANSD", () => {
    expect(estProduction({ PUBLIC_BASE_URL: "https://forum2026.ansd.sn" })).toBe(true);
    expect(estProduction({ PUBLIC_BASE_URL: "https://ansd.sn/forum" })).toBe(true);
  });

  it("laisse passer le poste de développement et la stack locale", () => {
    expect(estProduction({})).toBe(false);
    expect(estProduction({ PUBLIC_BASE_URL: "http://localhost:3000" })).toBe(false);
    expect(estProduction({ PUBLIC_BASE_URL: "http://localhost:3010", APP_ENV: "" })).toBe(false);
    expect(estProduction({ APP_ENV: "development" })).toBe(false);
  });

  it("ne se laisse pas tromper par un domaine qui ne fait que ressembler", () => {
    expect(estProduction({ PUBLIC_BASE_URL: "https://faux-ansd.sn.example.test" })).toBe(false);
    expect(estProduction({ PUBLIC_BASE_URL: "https://monansd.sn" })).toBe(false);
    expect(estProduction({ PUBLIC_BASE_URL: "pas une adresse" })).toBe(false);
  });
});
