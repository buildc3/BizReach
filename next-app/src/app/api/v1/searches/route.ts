import { NextRequest } from "next/server";
import * as repo from "@/lib/repo/searches";
import { ok, withRoute } from "@/lib/errors";
import { createSearchSchema } from "@/lib/schemas";
import { requireUser } from "@/lib/auth";

export const GET = withRoute(async (req: NextRequest) => {
  const userId = await requireUser(req);
  const searches = await repo.getSearches(userId);
  return ok(searches);
});

export const POST = withRoute(async (req: NextRequest) => {
  const userId = await requireUser(req);
  const input = createSearchSchema.parse(await req.json());
  const search = await repo.insertSearch(userId, input.name, input.bizType, input.area);
  return ok(search);
});
