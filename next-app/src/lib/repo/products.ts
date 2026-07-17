import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";

export async function getProducts() {
  return prisma.product.findMany({ orderBy: { createdAt: "asc" } });
}

export async function getProduct(id: string) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw AppError.notFound(`Product ${id} not found`);
  return product;
}

export async function insertProduct(
  name: string,
  description: string | null,
  price: number | null,
  category: string,
) {
  return prisma.product.create({ data: { name, description, price, category } });
}

export async function updateProduct(
  id: string,
  name: string,
  description: string | null,
  price: number | null,
  category: string,
  active: boolean,
) {
  return prisma.product.update({ where: { id }, data: { name, description, price, category, active } });
}

export async function deleteProduct(id: string) {
  await prisma.product.delete({ where: { id } });
}
