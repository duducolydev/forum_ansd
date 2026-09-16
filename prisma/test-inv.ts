import "dotenv/config";
import { prisma } from "../src/lib/db";
import { generateInvitationToken } from "../src/modules/invitations/service";

async function main() {
  const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
  const category = await prisma.participantCategory.findFirstOrThrow({
    where: { editionId: edition.id, code: "INS" },
  });
  const token = generateInvitationToken();
  const inv = await prisma.invitation.create({
    data: {
      editionId: edition.id,
      categoryId: category.id,
      email: `smoke-${Date.now()}@example.test`,
      firstName: "Smoke",
      lastName: "Test",
      token,
      status: "SENT",
      sentAt: new Date(),
    },
  });
  console.log(`TOKEN=${token}`);
  console.log(`ID=${inv.id}`);
}
main().finally(() => prisma.$disconnect());
