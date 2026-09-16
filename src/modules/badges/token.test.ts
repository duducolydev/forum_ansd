import { describe, expect, it } from "vitest";
import {
  badgeSignature,
  buildBadgeToken,
  hashBadgeToken,
  parseBadgeToken,
  verifyBadgeSignature,
} from "./token";

const PUBLIC_ID = "FID26-7K3M2P";

describe("token de badge (brief §5.4)", () => {
  it("produit `publicId.signature` avec 16 caractères base32", () => {
    const token = buildBadgeToken(PUBLIC_ID, 1);
    const [publicId, signature] = token.split(".");

    expect(publicId).toBe(PUBLIC_ID);
    expect(signature).toHaveLength(16);
    expect(signature).toMatch(/^[A-Z2-7]{16}$/);
  });

  it("est déterministe pour un même couple (publicId, version)", () => {
    expect(buildBadgeToken(PUBLIC_ID, 3)).toBe(buildBadgeToken(PUBLIC_ID, 3));
  });

  it("change de signature à chaque version — c'est ce qui invalide l'ancien QR", () => {
    const v1 = badgeSignature(PUBLIC_ID, 1);
    const v2 = badgeSignature(PUBLIC_ID, 2);
    expect(v1).not.toBe(v2);
  });

  it("change de signature d'un participant à l'autre", () => {
    expect(badgeSignature("FID26-AAAAAA", 1)).not.toBe(badgeSignature("FID26-BBBBBB", 1));
  });

  it("valide la signature de sa propre version et refuse les autres", () => {
    const token = buildBadgeToken(PUBLIC_ID, 2);
    expect(verifyBadgeSignature(token, 2)).toBe(true);
    expect(verifyBadgeSignature(token, 1)).toBe(false);
    expect(verifyBadgeSignature(token, 3)).toBe(false);
  });

  it("refuse une signature falsifiée", () => {
    const token = buildBadgeToken(PUBLIC_ID, 1);
    const tampered = `${PUBLIC_ID}.AAAAAAAAAAAAAAAA`;
    expect(tampered).not.toBe(token);
    expect(verifyBadgeSignature(tampered, 1)).toBe(false);
  });

  it("refuse un publicId modifié même avec une signature valide ailleurs", () => {
    const signature = badgeSignature(PUBLIC_ID, 1);
    expect(verifyBadgeSignature(`FID26-XXXXXX.${signature}`, 1)).toBe(false);
  });

  it("tolère la casse et les espaces (saisie manuelle en secours)", () => {
    const token = buildBadgeToken(PUBLIC_ID, 1);
    expect(verifyBadgeSignature(`  ${token.toLowerCase()}  `, 1)).toBe(true);
  });

  it("rejette les formes malformées", () => {
    expect(parseBadgeToken("")).toBeNull();
    expect(parseBadgeToken("sans-point")).toBeNull();
    expect(parseBadgeToken(".SIGNATURESEULE1")).toBeNull();
    expect(parseBadgeToken(`${PUBLIC_ID}.`)).toBeNull();
    expect(parseBadgeToken(`${PUBLIC_ID}.TROPCOURT`)).toBeNull();
    // 0, 1 et 8 n'appartiennent pas à l'alphabet base32 RFC 4648.
    expect(parseBadgeToken(`${PUBLIC_ID}.0000000000000001`)).toBeNull();
  });

  it("ne stocke jamais le token en clair : l'empreinte est stable et différente", () => {
    const token = buildBadgeToken(PUBLIC_ID, 1);
    const hash = hashBadgeToken(token);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(PUBLIC_ID);
    expect(hashBadgeToken(token)).toBe(hash);
    expect(hashBadgeToken(buildBadgeToken(PUBLIC_ID, 2))).not.toBe(hash);
  });
});
