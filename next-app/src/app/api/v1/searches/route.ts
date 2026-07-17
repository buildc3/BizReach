import { NextRequest } from "next/server";
import * as repo from "@/lib/repo/searches";
import { ok, withRoute } from "@/lib/errors";
import { createSearchSchema } from "@/lib/schemas";

export const GET = withRoute(async () => {
  const searches = await repo.getSearches();
  return ok(searches);
});

export const POST = withRoute(async (req: NextRequest) => {
  const input = createSearchSchema.parse(await req.json());
  const search = await repo.insertSearch(input.name, input.bizType, input.area);
  return ok(search);
});
