import type { Lead, Search, SenderProfile } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";

/**
 * Case-insensitive `{TOKEN}` → value substitution.
 *
 * Scans the template for `{…}` pairs, lowercases the token, looks it up,
 * and replaces it. Unrecognised tokens are kept verbatim so the user can
 * see what's still unfilled.
 */
export function renderTemplate(
  body: string,
  lead: Lead,
  search: Search,
  profile: SenderProfile | null | undefined,
): string {
  const vars: Record<string, string> = {
    business_name: lead.name,
    owner_name: lead.ownerName || "there",
    area: lead.address || "your area",
    phone: lead.phone || "",
    email: lead.email || "",
    website: lead.website || "",
    business_type: search.bizType,
    business_category: search.bizType,
    your_name: profile?.yourName || "",
    your_company_name: profile?.companyName || "",
    phone_number: profile?.phone || "",
    website_url: profile?.website || "",
  };

  let result = "";
  let rest = body;

  while (true) {
    const open = rest.indexOf("{");
    if (open === -1) {
      result += rest;
      break;
    }
    result += rest.slice(0, open);
    const after = rest.slice(open + 1);
    const close = after.indexOf("}");
    if (close === -1) {
      result += "{" + after;
      break;
    }
    const token = after.slice(0, close);
    const key = token.toLowerCase();
    result += key in vars ? vars[key] : `{${token}}`;
    rest = after.slice(close + 1);
  }

  return result;
}

export function hasPhone(lead: Lead): boolean {
  return !!lead.phone?.trim();
}

/** Insert a pitch as a draft message awaiting review. */
export async function insertDraft(leadId: string, templateId: string | null, body: string) {
  return prisma.message.create({ data: { leadId, templateId, body, status: "draft" } });
}

/**
 * Remove only the not-yet-reviewed drafts for a group's leads (regeneration).
 * Reviewed/sent pitches are left untouched.
 */
export async function deleteDraftPitchesForGroup(groupId: string) {
  const res = await prisma.message.deleteMany({ where: { status: "draft", lead: { groupId } } });
  return res.count;
}

export interface PitchWithLead {
  id: string;
  leadId: string;
  templateId: string | null;
  body: string;
  status: string;
  sentAt: Date | null;
  reviewedAt: Date | null;
  deliveredAt: Date | null;
  repliedAt: Date | null;
  createdAt: Date;
  leadName: string;
  leadPhone: string | null;
}

/** All pitches for a group's leads, with lead display info, for the review screen. */
export async function getGroupPitches(groupId: string): Promise<PitchWithLead[]> {
  const messages = await prisma.message.findMany({
    where: { lead: { groupId } },
    include: { lead: { select: { name: true, phone: true } } },
    orderBy: { createdAt: "asc" },
  });

  return messages.map((m) => ({
    id: m.id,
    leadId: m.leadId,
    templateId: m.templateId,
    body: m.body,
    status: m.status,
    sentAt: m.sentAt,
    reviewedAt: m.reviewedAt,
    deliveredAt: m.deliveredAt,
    repliedAt: m.repliedAt,
    createdAt: m.createdAt,
    leadName: m.lead.name,
    leadPhone: m.lead.phone,
  }));
}

/** Move a pitch through its review lifecycle (draft → reviewed | rejected | ...). */
export async function setPitchStatus(id: string, status: string) {
  const data = status === "reviewed" ? { status, reviewedAt: new Date() } : { status };
  return prisma.message.update({ where: { id }, data });
}

/** Edit a draft/reviewed pitch's body (only while still editable). */
export async function updatePitchBody(id: string, body: string) {
  const existing = await prisma.message.findUnique({ where: { id } });
  if (!existing || !["draft", "reviewed"].includes(existing.status)) {
    throw AppError.notFound(`Editable pitch ${id} not found`);
  }
  return prisma.message.update({ where: { id }, data: { body } });
}
