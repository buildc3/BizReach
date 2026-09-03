import { NextRequest } from "next/server";
import * as repo from "@/lib/repo/users";
import { AppError, ok, withRoute } from "@/lib/errors";
import { signupSchema } from "@/lib/schemas";
import { hashPassword, setAuthCookie, signToken } from "@/lib/auth";

export const POST = withRoute(async (req: NextRequest) => {
  const input = signupSchema.parse(await req.json());

  const existing = await repo.getUserByEmail(input.email);
  if (existing) throw AppError.conflict("An account with this email already exists");

  const passwordHash = await hashPassword(input.password);
  const user = await repo.createUser(input.email, passwordHash, input.name ?? null);
  const token = await signToken(user.id);

  const res = ok({ id: user.id, email: user.email, name: user.name });
  setAuthCookie(res, token);
  return res;
});
