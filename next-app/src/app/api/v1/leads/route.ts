import { NextRequest } from "next/server";
import * as repo from "@/lib/repo/leads";
import { ok, withRoute } from "@/lib/errors";
import { parseUuid } from "@/lib/schemas";

export const GET = withRoute(async (req: NextRequest) => {
  const searchId = parseUuid(req.nextUrl.searchParams.get("search_id") ?? "", "search_id");
  const leads = await repo.getLeads(searchId);
  return ok(leads);
});
