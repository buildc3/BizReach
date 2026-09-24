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
import { mapWithConcurrency } from "@/lib/concurrency";

// Allow long batches on serverless hosts (function time limits vary by plan).
export const maxDuration = 60;

// Gemini's free tier is rate-limited; a few parallel calls is the sweet spot.
const AI_CONCURRENCY = 4;

/**
 * Generate a per-lead draft pitch for every messageable lead in a group and
 * wait for it to finish before responding. Deliberately synchronous (not
 * fire-and-forget): serverless hosts can freeze the process right after the
 * response is sent, which would kill detached background work mid-batch.
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

  try {
    await pitchesRepo.deleteDraftPitchesForGroup(groupId, userId);
  } catch (e) {
    console.warn(`clearing old drafts failed for group ${groupId}:`, e);
  }

  // Can't message a lead without a phone.
  const leads = (await groupsRepo.getLeadsInGroup(groupId, userId)).filter(pitchesRepo.hasPhone);

  const results = await mapWithConcurrency(leads, mode === "ai" ? AI_CONCURRENCY : 1, async (lead) => {
    try {
      const body =
        mode === "ai"
          ? await pitchService.generatePitch(lead, search, product, instructions, profile)
          : pitchesRepo.renderTemplate(template!.body, lead, search, profile);
      await pitchesRepo.insertDraft(lead.id, template?.id ?? null, body);
      return true;
    } catch (e) {
      console.warn(`pitch failed for lead ${lead.id}:`, e);
      return false;
    }
  });

  const made = results.filter(Boolean).length;
  const failed = results.length - made;
  console.info(`group ${groupId}: generated ${made} draft pitches, ${failed} failed (${mode} mode)`);

  return ok(`generated ${made}, failed ${failed}`);
});
