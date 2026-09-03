import { NextRequest } from "next/server";
import * as repo from "@/lib/repo/users";
import { ok, withRoute } from "@/lib/errors";
import { requireUser } from "@/lib/auth";

export const GET = withRoute(async (req: NextRequest) => {
  const userId = await requireUser(req);
  const user = await repo.getUserById(userId);
  return ok({ id: user.id, email: user.email, name: user.name });
});
