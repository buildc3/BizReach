import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";

export async function getMessages(userId: string, leadId?: string) {
  return prisma.message.findMany({
    where: leadId ? { leadId, lead: { userId } } : { lead: { userId } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getFollowups(userId: string, olderThanDays: number) {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  return prisma.message.findMany({
    where: {
      lead: { userId },
      status: { in: ["sent", "delivered"] },
      repliedAt: null,
      sentAt: { lt: cutoff },
    },
    orderBy: { sentAt: "asc" },
  });
}

/**
 * Unscoped variants for the send-queue worker (`lib/services/send-queue.ts`).
 * That worker has no request/session context — it only ever operates on a
 * message ID that was already ownership-checked when it was enqueued by a
 * route handler, so re-checking `userId` here isn't meaningful.
 */
export async function getMessageInternal(id: string) {
  const message = await prisma.message.findUnique({ where: { id } });
  if (!message) throw AppError.notFound(`Message ${id} not found`);
  return message;
}

export async function updateMessageStatusInternal(id: string, status: string) {
  const data: { status: string; sentAt?: Date; repliedAt?: Date } = { status };
  if (status === "sent") data.sentAt = new Date();
  if (status === "replied") data.repliedAt = new Date();
  await prisma.message.update({ where: { id }, data });
}
