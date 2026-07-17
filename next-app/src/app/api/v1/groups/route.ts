import { NextRequest } from "next/server";
import * as repo from "@/lib/repo/groups";
import { ok, withRoute } from "@/lib/errors";
import { createGroupSchema, parseUuid } from "@/lib/schemas";

export const GET = withRoute(async (req: NextRequest) => {
  const searchId = parseUuid(req.nextUrl.searchParams.get("search_id") ?? "", "search_id");
  const groups = await repo.getGroups(searchId);
  return ok(groups);
});

export const POST = withRoute(async (req: NextRequest) => {
  const input = createGroupSchema.parse(await req.json());
  const group = await repo.insertGroup(input.searchId, input.name, "manual", 99);
  return ok(group);
});
