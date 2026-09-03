import { NextRequest } from "next/server";
import * as repo from "@/lib/repo/settings";
import { ok, withRoute } from "@/lib/errors";
import { updateProfileSchema } from "@/lib/schemas";
import { requireUser } from "@/lib/auth";

export const GET = withRoute(async (req: NextRequest) => {
  const userId = await requireUser(req);
  const profile = await repo.getSenderProfile(userId);
  return ok(profile);
});

export const PUT = withRoute(async (req: NextRequest) => {
  const userId = await requireUser(req);
  const input = updateProfileSchema.parse(await req.json());
  const profile = await repo.updateSenderProfile(
    userId,
    input.yourName ?? null,
    input.companyName ?? null,
    input.phone ?? null,
    input.website ?? null,
  );
  return ok(profile);
});
