import { NextRequest } from "next/server";
import * as repo from "@/lib/repo/users";
import { AppError, ok, withRoute } from "@/lib/errors";
import { loginSchema } from "@/lib/schemas";
import { setAuthCookie, signToken, verifyPassword } from "@/lib/auth";

// Same message whether the email is unknown or the password is wrong —
// don't leak which emails are registered via the login endpoint.
const INVALID_CREDENTIALS = "Invalid email or password";

export const POST = withRoute(async (req: NextRequest) => {
  const input = loginSchema.parse(await req.json());

  const user = await repo.getUserByEmail(input.email);
  if (!user) throw AppError.unauthorized(INVALID_CREDENTIALS);

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) throw AppError.unauthorized(INVALID_CREDENTIALS);

  const token = await signToken(user.id);
  const res = ok({ id: user.id, email: user.email, name: user.name });
  setAuthCookie(res, token);
  return res;
});
