import { NextRequest } from "next/server";
import * as repo from "@/lib/repo/products";
import { ok, withRoute } from "@/lib/errors";
import { productSchema } from "@/lib/schemas";
import { requireUser } from "@/lib/auth";

export const GET = withRoute(async (req: NextRequest) => {
  const userId = await requireUser(req);
  const products = await repo.getProducts(userId);
  return ok(products);
});

export const POST = withRoute(async (req: NextRequest) => {
  const userId = await requireUser(req);
  const input = productSchema.parse(await req.json());
  const product = await repo.insertProduct(userId, input.name, input.description ?? null, input.price ?? null, input.category);
  return ok(product);
});
