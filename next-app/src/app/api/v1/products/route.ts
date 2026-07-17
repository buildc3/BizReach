import { NextRequest } from "next/server";
import * as repo from "@/lib/repo/products";
import { ok, withRoute } from "@/lib/errors";
import { productSchema } from "@/lib/schemas";

export const GET = withRoute(async () => {
  const products = await repo.getProducts();
  return ok(products);
});

export const POST = withRoute(async (req: NextRequest) => {
  const input = productSchema.parse(await req.json());
  const product = await repo.insertProduct(input.name, input.description ?? null, input.price ?? null, input.category);
  return ok(product);
});
