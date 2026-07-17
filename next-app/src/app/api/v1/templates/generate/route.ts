import { NextRequest } from "next/server";
import * as productsRepo from "@/lib/repo/products";
import * as pitch from "@/lib/services/pitch";
import { ok, withRoute } from "@/lib/errors";
import { generateTemplateSchema } from "@/lib/schemas";

/**
 * AI-generate a reusable template body for a product, given a short description.
 * The selected product's context is automatically injected into the prompt.
 */
export const POST = withRoute(async (req: NextRequest) => {
  const input = generateTemplateSchema.parse(await req.json());
  const product = await productsRepo.getProduct(input.productId);
  const body = await pitch.generateTemplate(product, input.description);
  return ok(body);
});
