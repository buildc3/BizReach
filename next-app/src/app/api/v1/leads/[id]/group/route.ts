import { NextRequest } from "next/server";
import * as repo from "@/lib/repo/groups";
import { ok, withRoute } from "@/lib/errors";
import { moveLeadSchema, parseUuid } from "@/lib/schemas";

type Params = { params: Promise<{ id: string }> };

/** Move a single lead into a group (or out of any group when `groupId` is null). */
export const PUT = withRoute(async (req: NextRequest, { params }: Params) => {
  const leadId = parseUuid((await params).id);
  const input = moveLeadSchema.parse(await req.json());
  const lead = await repo.setLeadGroup(leadId, input.groupId);
  return ok(lead);
});
