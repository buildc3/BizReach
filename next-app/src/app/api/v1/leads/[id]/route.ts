import { NextRequest } from "next/server";
import * as repo from "@/lib/repo/leads";
import { ok, withRoute } from "@/lib/errors";
import { parseUuid } from "@/lib/schemas";
import { requireUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export const GET = withRoute(async (req: NextRequest, { params }: Params) => {
  const userId = await requireUser(req);
  const id = parseUuid((await params).id);
  const lead = await repo.getLead(id, userId);
  return ok(lead);
});
