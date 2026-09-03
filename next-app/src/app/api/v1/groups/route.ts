import { NextRequest } from "next/server";
import * as repo from "@/lib/repo/groups";
import * as searchesRepo from "@/lib/repo/searches";
import { ok, withRoute } from "@/lib/errors";
import { createGroupSchema, parseUuid } from "@/lib/schemas";
import { requireUser } from "@/lib/auth";

export const GET = withRoute(async (req: NextRequest) => {
  const userId = await requireUser(req);
  const searchId = parseUuid(req.nextUrl.searchParams.get("search_id") ?? "", "search_id");
  const groups = await repo.getGroups(searchId, userId);
  return ok(groups);
});

export const POST = withRoute(async (req: NextRequest) => {
  const userId = await requireUser(req);
  const input = createGroupSchema.parse(await req.json());
  await searchesRepo.getSearch(input.searchId, userId); // ownership check
  const group = await repo.insertGroup(input.searchId, input.name, "manual", 99);
  return ok(group);
});
