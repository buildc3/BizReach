import { prisma } from "@/lib/db";

// One row per user (was a single pre-seeded singleton pre-auth). A brand-new
// user has no row yet, and the Settings page always expects one back, so
// reads lazily create an empty row instead of 404ing.
export async function getSenderProfile(userId: string) {
  return prisma.senderProfile.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

export async function updateSenderProfile(
  userId: string,
  yourName: string | null,
  companyName: string | null,
  phone: string | null,
  website: string | null,
) {
  return prisma.senderProfile.upsert({
    where: { userId },
    create: { userId, yourName, companyName, phone, website },
    update: { yourName, companyName, phone, website, updatedAt: new Date() },
  });
}
