import { NextRequest } from "next/server";
import * as repo from "@/lib/repo/searches";
import { ok, withRoute } from "@/lib/errors";
import { parseUuid } from "@/lib/schemas";

type Params = { params: Promise<{ id: string }> };

export const GET = withRoute(async (_req: NextRequest, { params }: Params) => {
  const id = parseUuid((await params).id);
  const search = await repo.getSearch(id);
  return ok(search);
});

export const DELETE = withRoute(async (_req: NextRequest, { params }: Params) => {
  const id = parseUuid((await params).id);
  await repo.deleteSearch(id);
  return ok("deleted");
});
