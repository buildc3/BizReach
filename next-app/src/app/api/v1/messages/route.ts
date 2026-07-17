import { NextRequest } from "next/server";
import * as repo from "@/lib/repo/messages";
import { ok, withRoute } from "@/lib/errors";
import { parseUuid } from "@/lib/schemas";

export const GET = withRoute(async (req: NextRequest) => {
  const leadIdParam = req.nextUrl.searchParams.get("lead_id");
  const leadId = leadIdParam ? parseUuid(leadIdParam, "lead_id") : undefined;
  const messages = await repo.getMessages(leadId);
  return ok(messages);
});
