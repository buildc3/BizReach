import { NextRequest } from "next/server";
import * as repo from "@/lib/repo/templates";
import * as productsRepo from "@/lib/repo/products";
import { ok, withRoute } from "@/lib/errors";
import { templateSchema, parseUuid } from "@/lib/schemas";
import { requireUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export const PUT = withRoute(async (req: NextRequest, { params }: Params) => {
  const userId = await requireUser(req);
  const id = parseUuid((await params).id);
  const input = templateSchema.parse(await req.json());
  if (input.productId) await productsRepo.getProduct(input.productId, userId); // ownership check
  const template = await repo.updateTemplate(id, userId, input.name, input.body, input.productId ?? null);
  return ok(template);
});

export const DELETE = withRoute(async (req: NextRequest, { params }: Params) => {
  const userId = await requireUser(req);
  const id = parseUuid((await params).id);
  await repo.deleteTemplate(id, userId);
  return ok("deleted");
});
