import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";

export async function getProducts(userId: string) {
  return prisma.product.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
}

export async function getProduct(id: string, userId: string) {
  const product = await prisma.product.findFirst({ where: { id, userId } });
  if (!product) throw AppError.notFound(`Product ${id} not found`);
  return product;
}

export async function insertProduct(
  userId: string,
  name: string,
  description: string | null,
  price: number | null,
  category: string,
) {
  return prisma.product.create({ data: { userId, name, description, price, category } });
}

export async function updateProduct(
  id: string,
  userId: string,
  name: string,
  description: string | null,
  price: number | null,
  category: string,
  active: boolean,
) {
  const res = await prisma.product.updateMany({
    where: { id, userId },
    data: { name, description, price, category, active },
  });
  if (res.count === 0) throw AppError.notFound(`Product ${id} not found`);
  return prisma.product.findUniqueOrThrow({ where: { id } });
}

export async function deleteProduct(id: string, userId: string) {
  const res = await prisma.product.deleteMany({ where: { id, userId } });
  if (res.count === 0) throw AppError.notFound(`Product ${id} not found`);
}
