import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";

export async function getSearches(userId: string) {
  return prisma.search.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
}

export async function getSearch(id: string, userId: string) {
  const search = await prisma.search.findFirst({ where: { id, userId } });
  if (!search) throw AppError.notFound(`Search ${id} not found`);
  return search;
}

export async function insertSearch(userId: string, name: string, bizType: string, area: string) {
  return prisma.search.create({ data: { userId, name, bizType, area } });
}

export async function updateSearchStatus(id: string, userId: string, status: string) {
  const res = await prisma.search.updateMany({ where: { id, userId }, data: { status } });
  if (res.count === 0) throw AppError.notFound(`Search ${id} not found`);
}

export async function deleteSearch(id: string, userId: string) {
  const res = await prisma.search.deleteMany({ where: { id, userId } });
  if (res.count === 0) throw AppError.notFound(`Search ${id} not found`);
}
