import { NextRequest } from "next/server";
import * as repo from "@/lib/repo/templates";
import { ok, withRoute } from "@/lib/errors";
import { templateSchema, parseUuid } from "@/lib/schemas";

type Params = { params: Promise<{ id: string }> };

export const PUT = withRoute(async (req: NextRequest, { params }: Params) => {
  const id = parseUuid((await params).id);
  const input = templateSchema.parse(await req.json());
  const template = await repo.updateTemplate(id, input.name, input.body, input.productId ?? null);
  return ok(template);
});

export const DELETE = withRoute(async (_req: NextRequest, { params }: Params) => {
  const id = parseUuid((await params).id);
  await repo.deleteTemplate(id);
  return ok("deleted");
});
