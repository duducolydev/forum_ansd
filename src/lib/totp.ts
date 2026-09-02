import { generateSecret, generateURI, verify } from "otplib";

const ISSUER = "Forum ANSD";

export function generateTotpSecret(): string {
  return generateSecret();
}

export function totpKeyUri(accountEmail: string, secret: string): string {
  return generateURI({ issuer: ISSUER, label: accountEmail, secret });
}

export async function verifyTotpCode(secret: string, code: string): Promise<boolean> {
  try {
    const result = await verify({ secret, token: code });
    return result.valid;
  } catch {
    return false;
  }
}
