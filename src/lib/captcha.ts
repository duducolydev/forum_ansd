/**
 * Anti-bot (brief §5.3, décision PLAN.md C4). Cloudflare Turnstile quand les
 * clés sont fournies, sinon implémentation neutre : le honeypot et le
 * rate-limit restent actifs indépendamment, ils ne dépendent pas de ce module.
 */
export interface CaptchaProvider {
  readonly enabled: boolean;
  readonly siteKey: string | null;
  verify(token: string | null, remoteIp?: string): Promise<boolean>;
}

class NoopCaptchaProvider implements CaptchaProvider {
  readonly enabled = false;
  readonly siteKey = null;

  verify(): Promise<boolean> {
    return Promise.resolve(true);
  }
}

class TurnstileCaptchaProvider implements CaptchaProvider {
  readonly enabled = true;

  constructor(
    readonly siteKey: string,
    private readonly secretKey: string,
  ) {}

  async verify(token: string | null, remoteIp?: string): Promise<boolean> {
    if (!token) return false;
    try {
      const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: this.secretKey, response: token, remoteip: remoteIp }),
      });
      const result = (await response.json()) as { success?: boolean };
      return result.success === true;
    } catch {
      return false;
    }
  }
}

function createCaptchaProvider(): CaptchaProvider {
  const siteKey = process.env.TURNSTILE_SITE_KEY;
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (siteKey && secretKey) {
    return new TurnstileCaptchaProvider(siteKey, secretKey);
  }
  /*
   * En production, l'absence de clés ne doit pas passer inaperçue : l'anti-robot
   * se réduit alors au champ piège et à la limite de débit (PLAN.md §18). Pas
   * pendant la construction, qui évalue ce module sans être un déploiement.
   */
  if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    console.warn(
      "[captcha] TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY absentes : inscription publique protégée par le seul champ piège et la limite de débit.",
    );
  }
  return new NoopCaptchaProvider();
}

export const captchaProvider: CaptchaProvider = createCaptchaProvider();
