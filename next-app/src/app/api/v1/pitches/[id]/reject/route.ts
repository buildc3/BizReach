import { NextRequest } from "next/server";
import * as repo from "@/lib/repo/pitches";
import { ok, withRoute } from "@/lib/errors";
import { parseUuid } from "@/lib/schemas";

type Params = { params: Promise<{ id: string }> };

export const POST = withRoute(async (_req: NextRequest, { params }: Params) => {
  const id = parseUuid((await params).id);
  const msg = await repo.setPitchStatus(id, "rejected");
  return ok(msg);
});
