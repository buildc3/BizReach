import { NextRequest } from "next/server";
import * as pitch from "@/lib/services/pitch";
import { ok, withRoute } from "@/lib/errors";
import { aiFillSchema } from "@/lib/schemas";
import { requireUser } from "@/lib/auth";

export const POST = withRoute(async (req: NextRequest) => {
  await requireUser(req);
  const input = aiFillSchema.parse(await req.json());
  const fill = await pitch.fillProduct(input.rawDescription);
  return ok(fill);
});
