import { NextRequest } from "next/server";
import * as repo from "@/lib/repo/messages";
import { ok, withRoute } from "@/lib/errors";
import { requireUser } from "@/lib/auth";

export const GET = withRoute(async (req: NextRequest) => {
  const userId = await requireUser(req);
  const raw = req.nextUrl.searchParams.get("older_than_days");
  const days = raw ? Number(raw) : 3;
  const messages = await repo.getFollowups(userId, Number.isFinite(days) ? days : 3);
  return ok(messages);
});
