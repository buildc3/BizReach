import { NextRequest } from "next/server";
import * as pitchesRepo from "@/lib/repo/pitches";
import * as sendQueue from "@/lib/services/send-queue";
import { ok, withRoute } from "@/lib/errors";
import { sendGroupSchema } from "@/lib/schemas";
import { requireUser } from "@/lib/auth";

/** Enqueue all reviewed pitches for a group into the rate-limited send queue. */
export const POST = withRoute(async (req: NextRequest) => {
  const userId = await requireUser(req);
  const input = sendGroupSchema.parse(await req.json());
  const pitches = await pitchesRepo.getGroupPitches(input.groupId, userId);

  let queued = 0;
  for (const p of pitches) {
    if (p.status === "reviewed") {
      await pitchesRepo.setPitchStatus(p.id, userId, "queued");
      sendQueue.enqueue(p.id);
      queued++;
    }
  }

  return ok({ queued });
});
