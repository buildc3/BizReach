import { NextRequest } from "next/server";
import * as repo from "@/lib/repo/pitches";
import * as sendQueue from "@/lib/services/send-queue";
import { ok, withRoute } from "@/lib/errors";
import { parseUuid } from "@/lib/schemas";
import { requireUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

/** Re-enqueue a failed pitch into the rate-limited send queue. */
export const POST = withRoute(async (req: NextRequest, { params }: Params) => {
  const userId = await requireUser(req);
  const id = parseUuid((await params).id);
  const msg = await repo.requeueFailedPitch(id, userId);
  sendQueue.enqueue(id);
  return ok(msg);
});
