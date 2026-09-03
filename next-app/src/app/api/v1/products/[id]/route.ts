import { NextRequest } from "next/server";
import * as repo from "@/lib/repo/products";
import { ok, withRoute } from "@/lib/errors";
import { productSchema, parseUuid } from "@/lib/schemas";
import { requireUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export const GET = withRoute(async (req: NextRequest, { params }: Params) => {
  const userId = await requireUser(req);
  const id = parseUuid((await params).id);
  const product = await repo.getProduct(id, userId);
  return ok(product);
});

export const PUT = withRoute(async (req: NextRequest, { params }: Params) => {
  const userId = await requireUser(req);
  const id = parseUuid((await params).id);
  const input = productSchema.parse(await req.json());
  const product = await repo.updateProduct(
    id,
    userId,
    input.name,
    input.description ?? null,
    input.price ?? null,
    input.category,
    input.active,
  );
  return ok(product);
});

export const DELETE = withRoute(async (req: NextRequest, { params }: Params) => {
  const userId = await requireUser(req);
  const id = parseUuid((await params).id);
  await repo.deleteProduct(id, userId);
  return ok("deleted");
});
