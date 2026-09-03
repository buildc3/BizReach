import { NextRequest } from "next/server";
import * as repo from "@/lib/repo/searches";
import { ok, withRoute } from "@/lib/errors";
import { parseUuid } from "@/lib/schemas";
import { requireUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export const GET = withRoute(async (req: NextRequest, { params }: Params) => {
  const userId = await requireUser(req);
  const id = parseUuid((await params).id);
  const search = await repo.getSearch(id, userId);
  return ok(search);
});

export const DELETE = withRoute(async (req: NextRequest, { params }: Params) => {
  const userId = await requireUser(req);
  const id = parseUuid((await params).id);
  await repo.deleteSearch(id, userId);
  return ok("deleted");
});
