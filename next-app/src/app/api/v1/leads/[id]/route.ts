import { NextRequest } from "next/server";
import * as repo from "@/lib/repo/leads";
import { ok, withRoute } from "@/lib/errors";
import { parseUuid } from "@/lib/schemas";

type Params = { params: Promise<{ id: string }> };

export const GET = withRoute(async (_req: NextRequest, { params }: Params) => {
  const id = parseUuid((await params).id);
  const lead = await repo.getLead(id);
  return ok(lead);
});
