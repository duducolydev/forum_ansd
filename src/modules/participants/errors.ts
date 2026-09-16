import type { ParticipantStatus } from "@prisma/client";

export class InvalidParticipantTransitionError extends Error {
  constructor(
    public readonly from: ParticipantStatus,
    public readonly attemptedAction: string,
  ) {
    super(`Transition impossible : action "${attemptedAction}" depuis le statut "${from}".`);
    this.name = "InvalidParticipantTransitionError";
  }
}

export class DuplicateParticipantEmailError extends Error {
  constructor(public readonly email: string) {
    super(`Un participant existe déjà avec l'e-mail ${email} pour cette édition.`);
    this.name = "DuplicateParticipantEmailError";
  }
}
