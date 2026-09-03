import { NextRequest } from "next/server";
import * as repo from "@/lib/repo/pitches";
import { ok, withRoute } from "@/lib/errors";
import { updatePitchSchema, parseUuid } from "@/lib/schemas";
import { requireUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

/** Edit a draft/reviewed pitch's text. */
export const PUT = withRoute(async (req: NextRequest, { params }: Params) => {
  const userId = await requireUser(req);
  const id = parseUuid((await params).id);
  const input = updatePitchSchema.parse(await req.json());
  const msg = await repo.updatePitchBody(id, userId, input.body);
  return ok(msg);
});
