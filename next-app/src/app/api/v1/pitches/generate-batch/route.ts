import { NextRequest } from "next/server";
import * as groupsRepo from "@/lib/repo/groups";
import * as searchesRepo from "@/lib/repo/searches";
import * as templatesRepo from "@/lib/repo/templates";
import * as productsRepo from "@/lib/repo/products";
import * as settingsRepo from "@/lib/repo/settings";
import * as pitchesRepo from "@/lib/repo/pitches";
import * as pitchService from "@/lib/services/pitch";
import { AppError, ok, withRoute } from "@/lib/errors";
import { generateBatchSchema } from "@/lib/schemas";
import { requireUser } from "@/lib/auth";

/**
 * Generate a per-lead draft pitch for every messageable lead in a group.
 * Returns immediately; generation runs in the background (poll GET /pitches).
 * Existing un-reviewed drafts for the group are replaced.
 */
export const POST = withRoute(async (req: NextRequest) => {
  const userId = await requireUser(req);
  const input = generateBatchSchema.parse(await req.json());

  const group = await groupsRepo.getGroup(input.groupId, userId);
  const search = await searchesRepo.getSearch(group.searchId, userId);

  const template = input.templateId ? await templatesRepo.getTemplate(input.templateId, userId) : null;
  if (input.mode === "template" && !template) {
    throw AppError.validation("templateId is required for template mode");
  }
  const product = input.productId ? await productsRepo.getProduct(input.productId, userId) : null;
  const profile = await settingsRepo.getSenderProfile(userId);

  const { groupId, mode, instructions } = input;

  void (async () => {
    try {
      await pitchesRepo.deleteDraftPitchesForGroup(groupId, userId);
    } catch (e) {
      console.warn(`clearing old drafts failed for group ${groupId}:`, e);
    }

    let leads;
    try {
      leads = await groupsRepo.getLeadsInGroup(groupId, userId);
    } catch (e) {
      console.error(`loading leads for group ${groupId} failed:`, e);
      return;
    }

    let made = 0;
    for (const lead of leads) {
      if (!pitchesRepo.hasPhone(lead)) continue; // can't message without a phone

      let body: string;
      if (mode === "ai") {
        try {
          body = await pitchService.generatePitch(lead, search, product, instructions, profile);
        } catch (e) {
          console.warn(`AI pitch failed for lead ${lead.id}:`, e);
          continue;
        }
      } else {
        body = pitchesRepo.renderTemplate(template!.body, lead, search, profile);
      }

      try {
        await pitchesRepo.insertDraft(lead.id, template?.id ?? null, body);
        made++;
      } catch (e) {
        console.warn(`insert draft failed for lead ${lead.id}:`, e);
      }
    }
    console.info(`group ${groupId}: generated ${made} draft pitches (${mode} mode)`);
  })();

  return ok("started");
});
