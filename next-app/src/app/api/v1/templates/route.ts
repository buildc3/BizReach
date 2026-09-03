import { NextRequest } from "next/server";
import * as repo from "@/lib/repo/templates";
import * as productsRepo from "@/lib/repo/products";
import { ok, withRoute } from "@/lib/errors";
import { templateSchema } from "@/lib/schemas";
import { requireUser } from "@/lib/auth";

export const GET = withRoute(async (req: NextRequest) => {
  const userId = await requireUser(req);
  const templates = await repo.getTemplates(userId);
  return ok(templates);
});

export const POST = withRoute(async (req: NextRequest) => {
  const userId = await requireUser(req);
  const input = templateSchema.parse(await req.json());
  if (input.productId) await productsRepo.getProduct(input.productId, userId); // ownership check
  const template = await repo.insertTemplate(userId, input.name, input.body, input.productId ?? null);
  return ok(template);
});
