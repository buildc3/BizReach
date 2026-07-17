import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";

export async function getSearches() {
  return prisma.search.findMany({ orderBy: { createdAt: "desc" } });
}

export async function getSearch(id: string) {
  const search = await prisma.search.findUnique({ where: { id } });
  if (!search) throw AppError.notFound(`Search ${id} not found`);
  return search;
}

export async function insertSearch(name: string, bizType: string, area: string) {
  return prisma.search.create({ data: { name, bizType, area } });
}

export async function updateSearchStatus(id: string, status: string) {
  await prisma.search.update({ where: { id }, data: { status } });
}

export async function deleteSearch(id: string) {
  await prisma.search.delete({ where: { id } });
}
