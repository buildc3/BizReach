import { NextRequest } from "next/server";
import * as repo from "@/lib/repo/groups";
import { ok, withRoute } from "@/lib/errors";
import { parseUuid } from "@/lib/schemas";
import { requireUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

/**
 * (Re)build the contact-channel buckets for a search. Idempotent — only touches
 * leads that aren't already in a group.
 */
export const POST = withRoute(async (req: NextRequest, { params }: Params) => {
  const userId = await requireUser(req);
  const searchId = parseUuid((await params).id);
  const groups = await repo.autoGroupByContact(searchId, userId);
  return ok(groups);
});
