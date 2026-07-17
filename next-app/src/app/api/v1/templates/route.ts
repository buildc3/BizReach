import { NextRequest } from "next/server";
import * as repo from "@/lib/repo/templates";
import { ok, withRoute } from "@/lib/errors";
import { templateSchema } from "@/lib/schemas";

export const GET = withRoute(async () => {
  const templates = await repo.getTemplates();
  return ok(templates);
});

export const POST = withRoute(async (req: NextRequest) => {
  const input = templateSchema.parse(await req.json());
  const template = await repo.insertTemplate(input.name, input.body, input.productId ?? null);
  return ok(template);
});
