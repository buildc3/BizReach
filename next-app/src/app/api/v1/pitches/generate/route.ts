import { NextRequest } from "next/server";
import * as leadsRepo from "@/lib/repo/leads";
import * as searchesRepo from "@/lib/repo/searches";
import * as productsRepo from "@/lib/repo/products";
import * as settingsRepo from "@/lib/repo/settings";
import * as pitch from "@/lib/services/pitch";
import { ok, withRoute } from "@/lib/errors";
import { generatePitchSchema } from "@/lib/schemas";
import { requireUser } from "@/lib/auth";

/** Generate a fresh, AI-written outreach message for a lead (no template needed). */
export const POST = withRoute(async (req: NextRequest) => {
  const userId = await requireUser(req);
  const input = generatePitchSchema.parse(await req.json());
  const lead = await leadsRepo.getLead(input.leadId, userId);
  const search = await searchesRepo.getSearch(lead.searchId, userId);
  const product = input.productId ? await productsRepo.getProduct(input.productId, userId) : null;
  const profile = await settingsRepo.getSenderProfile(userId);
  const message = await pitch.generatePitch(lead, search, product, input.instructions, profile);
  return ok(message);
});
