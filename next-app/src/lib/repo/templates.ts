import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";

export async function getTemplates() {
  return prisma.template.findMany({ orderBy: { createdAt: "desc" } });
}

export async function getTemplate(id: string) {
  const template = await prisma.template.findUnique({ where: { id } });
  if (!template) throw AppError.notFound(`Template ${id} not found`);
  return template;
}

export async function insertTemplate(name: string, body: string, productId: string | null) {
  return prisma.template.create({ data: { name, body, productId } });
}

export async function updateTemplate(id: string, name: string, body: string, productId: string | null) {
  return prisma.template.update({ where: { id }, data: { name, body, productId } });
}

export async function deleteTemplate(id: string) {
  await prisma.template.delete({ where: { id } });
}
