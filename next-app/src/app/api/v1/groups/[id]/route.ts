import { NextRequest } from "next/server";
import * as repo from "@/lib/repo/groups";
import { ok, withRoute } from "@/lib/errors";
import { renameGroupSchema, parseUuid } from "@/lib/schemas";

type Params = { params: Promise<{ id: string }> };

export const PUT = withRoute(async (req: NextRequest, { params }: Params) => {
  const id = parseUuid((await params).id);
  const input = renameGroupSchema.parse(await req.json());
  const group = await repo.renameGroup(id, input.name);
  return ok(group);
});

export const DELETE = withRoute(async (_req: NextRequest, { params }: Params) => {
  const id = parseUuid((await params).id);
  await repo.deleteGroup(id);
  return ok("deleted");
});
