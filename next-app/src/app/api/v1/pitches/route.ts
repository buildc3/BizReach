import { NextRequest } from "next/server";
import * as repo from "@/lib/repo/pitches";
import { ok, withRoute } from "@/lib/errors";
import { parseUuid } from "@/lib/schemas";
import { requireUser } from "@/lib/auth";

export const GET = withRoute(async (req: NextRequest) => {
  const userId = await requireUser(req);
  const groupId = parseUuid(req.nextUrl.searchParams.get("group_id") ?? "", "group_id");
  const pitches = await repo.getGroupPitches(groupId, userId);
  return ok(pitches);
});
