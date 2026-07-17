import { NextRequest } from "next/server";
import * as repo from "@/lib/repo/pitches";
import { ok, withRoute } from "@/lib/errors";
import { parseUuid } from "@/lib/schemas";

export const GET = withRoute(async (req: NextRequest) => {
  const groupId = parseUuid(req.nextUrl.searchParams.get("group_id") ?? "", "group_id");
  const pitches = await repo.getGroupPitches(groupId);
  return ok(pitches);
});
