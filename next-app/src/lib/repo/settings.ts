import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";

// Singleton row, pre-seeded by migration 007 (backend/src/db/migrations).
const PROFILE_ID = "00000000-0000-0000-0000-000000000001";

export async function getSenderProfile() {
  const profile = await prisma.senderProfile.findUnique({ where: { id: PROFILE_ID } });
  if (!profile) throw new AppError("DATABASE", "Sender profile row missing", 500);
  return profile;
}

export async function updateSenderProfile(
  yourName: string | null,
  companyName: string | null,
  phone: string | null,
  website: string | null,
) {
  return prisma.senderProfile.update({
    where: { id: PROFILE_ID },
    data: { yourName, companyName, phone, website, updatedAt: new Date() },
  });
}
