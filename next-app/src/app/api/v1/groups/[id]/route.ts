import { NextRequest } from "next/server";
import * as repo from "@/lib/repo/groups";
import { ok, withRoute } from "@/lib/errors";
import { renameGroupSchema, parseUuid } from "@/lib/schemas";
import { requireUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export const PUT = withRoute(async (req: NextRequest, { params }: Params) => {
  const userId = await requireUser(req);
  const id = parseUuid((await params).id);
  const input = renameGroupSchema.parse(await req.json());
  const group = await repo.renameGroup(id, userId, input.name);
  return ok(group);
});

export const DELETE = withRoute(async (req: NextRequest, { params }: Params) => {
  const userId = await requireUser(req);
  const id = parseUuid((await params).id);
  await repo.deleteGroup(id, userId);
  return ok("deleted");
});
