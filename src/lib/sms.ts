export interface SmsMessage {
  to: string;
  body: string;
}

export interface SmsSendResult {
  providerMessageId: string;
}

export interface SmsProvider {
  readonly name: string;
  /** `false` quand aucun opérateur n'est configuré : l'appelant peut alors ne pas proposer le canal. */
  readonly enabled: boolean;
  send(message: SmsMessage): Promise<SmsSendResult>;
}

/**
 * Fournisseur par défaut : **n'envoie rien**, journalise seulement.
 *
 * Le brief (§13) exclut explicitement l'envoi de SMS réels du Lot 1 — aucun
 * contrat opérateur n'est signé. L'interface est posée dès maintenant pour que
 * `modules/notifications` programme contre une abstraction stable ; brancher un
 * opérateur (Orange, Twilio…) ne demandera qu'une nouvelle implémentation, sans
 * toucher aux appelants.
 */
export class LogSmsProvider implements SmsProvider {
  readonly name = "log";
  readonly enabled = false;

  async send(message: SmsMessage): Promise<SmsSendResult> {
    console.info(`[sms:log] → ${message.to} : ${message.body.slice(0, 120)}`);
    return { providerMessageId: `log-${crypto.randomUUID()}` };
  }
}

function createSmsProvider(): SmsProvider {
  const driver = process.env.SMS_DRIVER ?? "log";
  if (driver !== "log") {
    throw new Error(
      `Fournisseur SMS "${driver}" non implémenté (seul "log" existe — cf. brief §13, Lot 1).`,
    );
  }
  return new LogSmsProvider();
}

export const smsProvider: SmsProvider = createSmsProvider();
