import { NextRequest } from "next/server";
import * as repo from "@/lib/repo/leads";
import { ok, withRoute } from "@/lib/errors";
import { parseUuid } from "@/lib/schemas";
import { requireUser } from "@/lib/auth";

export const GET = withRoute(async (req: NextRequest) => {
  const userId = await requireUser(req);
  const searchId = parseUuid(req.nextUrl.searchParams.get("search_id") ?? "", "search_id");
  const leads = await repo.getLeads(searchId, userId);
  return ok(leads);
});
