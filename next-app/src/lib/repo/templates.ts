import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";

export async function getTemplates(userId: string) {
  return prisma.template.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
}

export async function getTemplate(id: string, userId: string) {
  const template = await prisma.template.findFirst({ where: { id, userId } });
  if (!template) throw AppError.notFound(`Template ${id} not found`);
  return template;
}

export async function insertTemplate(userId: string, name: string, body: string, productId: string | null) {
  return prisma.template.create({ data: { userId, name, body, productId } });
}

export async function updateTemplate(id: string, userId: string, name: string, body: string, productId: string | null) {
  const res = await prisma.template.updateMany({ where: { id, userId }, data: { name, body, productId } });
  if (res.count === 0) throw AppError.notFound(`Template ${id} not found`);
  return prisma.template.findUniqueOrThrow({ where: { id } });
}

export async function deleteTemplate(id: string, userId: string) {
  const res = await prisma.template.deleteMany({ where: { id, userId } });
  if (res.count === 0) throw AppError.notFound(`Template ${id} not found`);
}
