import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createParticipant } from "@/modules/participants/service";
import { verifyBadgePublicly } from "./public-verify";
import { buildBadgeToken, hashBadgeToken } from "./token";

const ACTOR = { type: "SYSTEM" as const };
const emails: string[] = [];
let editionId = "";
let editionCode = "";
let categoryId = "";

/** IP distincte par test : la limite de débit est comptée par IP. */
function freshIp(): string {
  return `ip-${crypto.randomUUID()}`;
}

async function makeParticipant() {
  const email = `verify-${crypto.randomUUID()}@example.test`;
  emails.push(email);
  return createParticipant({
    editionId,
    editionCode,
    source: "ONSITE",
    actor: ACTOR,
    input: {
      firstName: "Aminata",
      lastName: "Sow",
      email,
      country: "Sénégal",
      locale: "fr",
      categoryId,
      organization: "ANSD",
      jobTitle: "Directrice des statistiques démographiques",
      attendsOpening: false,
      attendsInaugural: false,
      attendsAwards: false,
      needsAccommodation: false,
      needsTransport: false,
    },
  });
}

/**
 * Le badge est inséré directement plutôt que rendu : la vérification ne dépend
 * pas du PDF/PNG, et le test reste exécutable sans navigateur (donc en CI même
 * sans Chromium).
 */
async function makeBadge(participantId: string, publicId: string, version = 1) {
  const qrToken = hashBadgeToken(buildBadgeToken(publicId, version));

  // Le badge est **récupéré ou créé** : l'empreinte du QR étant déterministe
  // pour un couple (publicId, version), un `create` sec échouait dès qu'un job
  // de génération avait déjà produit la ligne. Ce que ces tests exigent, c'est
  // qu'un badge existe — pas de l'avoir créé eux-mêmes.
  const existant = await prisma.badge.findUnique({ where: { qrToken } });
  if (existant) return existant;

  try {
    return await prisma.badge.create({
      data: {
        participant: { connect: { id: participantId } },
        version,
        qrToken,
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    // Le worker de génération peut insérer la ligne entre la lecture et
    // l'écriture : on rattrape la collision au lieu de la subir, comme le fait
    // `ensureBadgeRow` côté service.
    const code = (error as { code?: string }).code;
    if (code !== "P2002") throw error;
    return prisma.badge.findUniqueOrThrow({ where: { qrToken } });
  }
}

describe("vérification publique du badge (brief §5.4, §2.11)", () => {
  beforeAll(async () => {
    const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
    editionId = edition.id;
    editionCode = edition.code;
    // Catégorie **sans** validation automatique : une catégorie auto-confirmée
    // met un job de génération de badge en file, dont le worker crée la ligne
    // `Badge` en concurrence avec celle que ces tests insèrent — collision sur
    // `Badge_qrToken_key`, de façon intermittente.
    const category = await prisma.participantCategory.findFirstOrThrow({
      where: { editionId, code: "SPONSOR" },
    });
    categoryId = category.id;
  });

  afterAll(async () => {
    await prisma.participant.deleteMany({ where: { email: { in: emails } } });
    await prisma.$disconnect();
  });

  it("valide un token issu du QR avec le niveau de preuve SIGNED", async () => {
    const participant = await makeParticipant();
    await makeBadge(participant.id, participant.publicId);

    const result = await verifyBadgePublicly(buildBadgeToken(participant.publicId, 1), freshIp());

    expect(result.status).toBe("VALID");
    if (result.status !== "VALID") return;
    expect(result.assurance).toBe("SIGNED");
    expect(result.participant.lastName).toBe("Sow");
    expect(result.participant.organization).toBe("ANSD");
    expect(result.participant.categoryLabel).toBe("Sponsor");
  });

  it("accepte l'identifiant seul en secours, mais avec le niveau IDENTIFIER", async () => {
    const participant = await makeParticipant();
    await makeBadge(participant.id, participant.publicId);

    const result = await verifyBadgePublicly(participant.publicId.toLowerCase(), freshIp());

    expect(result.status).toBe("VALID");
    if (result.status !== "VALID") return;
    // La saisie manuelle ne prouve pas l'authenticité du support : le niveau de
    // preuve doit rester distinct de celui d'un QR vérifié.
    expect(result.assurance).toBe("IDENTIFIER");
  });

  it("n'expose jamais e-mail, téléphone ni photo (§2.11)", async () => {
    const participant = await makeParticipant();
    await makeBadge(participant.id, participant.publicId);

    const result = await verifyBadgePublicly(buildBadgeToken(participant.publicId, 1), freshIp());

    const serialised = JSON.stringify(result);
    expect(serialised).not.toContain("@example.test");
    expect(serialised).not.toContain("photoPath");
    expect(serialised).not.toContain("phone");
    if (result.status === "VALID") {
      expect(Object.keys(result.participant).sort()).toEqual([
        "categoryLabel",
        "country",
        "firstName",
        "lastName",
        "organization",
        "publicId",
      ]);
    }
  });

  it("refuse une signature falsifiée", async () => {
    const participant = await makeParticipant();
    await makeBadge(participant.id, participant.publicId);

    const forged = `${participant.publicId}.AAAAAAAAAAAAAAAA`;
    expect((await verifyBadgePublicly(forged, freshIp())).status).toBe("UNKNOWN");
  });

  it("renvoie REVOKED pour un badge retiré, par QR comme par identifiant", async () => {
    const participant = await makeParticipant();
    const badge = await makeBadge(participant.id, participant.publicId);
    await prisma.badge.update({
      where: { id: badge.id },
      data: { revokedAt: new Date(), revokeReason: "Badge perdu" },
    });

    const byToken = await verifyBadgePublicly(buildBadgeToken(participant.publicId, 1), freshIp());
    expect(byToken.status).toBe("REVOKED");
    if (byToken.status === "REVOKED") expect(byToken.reason).toBe("Badge perdu");

    const byId = await verifyBadgePublicly(participant.publicId, freshIp());
    expect(byId.status).toBe("REVOKED");
  });

  it("refuse un badge non révoqué dont la participation est annulée", async () => {
    const participant = await makeParticipant();
    await makeBadge(participant.id, participant.publicId);
    await prisma.participant.update({
      where: { id: participant.id },
      data: { status: "CANCELLED" },
    });

    const result = await verifyBadgePublicly(buildBadgeToken(participant.publicId, 1), freshIp());
    expect(result.status).toBe("CANCELLED");
  });

  it("distingue « aucun badge émis » d'un identifiant inconnu", async () => {
    const participant = await makeParticipant();
    // Le sujet du test est un participant **sans badge** : on s'en assure au
    // lieu de le supposer, la file de génération pouvant en produire un.
    await prisma.badge.deleteMany({ where: { participantId: participant.id } });

    expect((await verifyBadgePublicly(participant.publicId, freshIp())).status).toBe("NOT_BADGED");
    expect((await verifyBadgePublicly("FID26-ZZZZZZ", freshIp())).status).toBe("UNKNOWN");
    expect((await verifyBadgePublicly("   ", freshIp())).status).toBe("UNKNOWN");
  });

  it("limite les contrôles à 30 par minute et par IP", async () => {
    const ip = freshIp();
    const statuses: string[] = [];
    for (let i = 0; i < 31; i++) {
      statuses.push((await verifyBadgePublicly("FID26-ZZZZZZ", ip)).status);
    }

    expect(statuses.slice(0, 30).every((status) => status === "UNKNOWN")).toBe(true);
    expect(statuses[30]).toBe("RATE_LIMITED");
  });
});
