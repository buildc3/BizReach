import { NextRequest } from "next/server";
import * as repo from "@/lib/repo/settings";
import { ok, withRoute } from "@/lib/errors";
import { updateProfileSchema } from "@/lib/schemas";

export const GET = withRoute(async () => {
  const profile = await repo.getSenderProfile();
  return ok(profile);
});

export const PUT = withRoute(async (req: NextRequest) => {
  const input = updateProfileSchema.parse(await req.json());
  const profile = await repo.updateSenderProfile(
    input.yourName ?? null,
    input.companyName ?? null,
    input.phone ?? null,
    input.website ?? null,
  );
  return ok(profile);
});
