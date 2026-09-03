import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";

export async function createUser(email: string, passwordHash: string, name: string | null) {
  return prisma.user.create({ data: { email, passwordHash, name } });
}

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw AppError.unauthorized();
  return user;
}
