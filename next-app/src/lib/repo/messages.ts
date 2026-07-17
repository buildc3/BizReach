import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";

export async function getMessage(id: string) {
  const message = await prisma.message.findUnique({ where: { id } });
  if (!message) throw AppError.notFound(`Message ${id} not found`);
  return message;
}

export async function getMessages(leadId?: string) {
  return prisma.message.findMany({
    where: leadId ? { leadId } : undefined,
    orderBy: { createdAt: "desc" },
  });
}

export async function getFollowups(olderThanDays: number) {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  return prisma.message.findMany({
    where: {
      status: { in: ["sent", "delivered"] },
      repliedAt: null,
      sentAt: { lt: cutoff },
    },
    orderBy: { sentAt: "asc" },
  });
}

export async function updateMessageStatus(id: string, status: string) {
  const data: { status: string; sentAt?: Date; repliedAt?: Date } = { status };
  if (status === "sent") data.sentAt = new Date();
  if (status === "replied") data.repliedAt = new Date();
  await prisma.message.update({ where: { id }, data });
}
