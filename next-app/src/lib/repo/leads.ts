import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";

export interface InsertLead {
  searchId: string;
  name: string;
  ownerName?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  mapsUrl?: string | null;
  lat?: number | null;
  lon?: number | null;
  source?: string | null;
}

export async function getLeads(searchId: string, userId: string) {
  return prisma.lead.findMany({ where: { searchId, userId }, orderBy: { createdAt: "desc" } });
}

export async function getLead(id: string, userId: string) {
  const lead = await prisma.lead.findFirst({ where: { id, userId } });
  if (!lead) throw AppError.notFound(`Lead ${id} not found`);
  return lead;
}

export async function insertLead(userId: string, lead: InsertLead) {
  return prisma.lead.create({ data: { ...lead, userId } });
}

/** Unscoped variant for the send-queue worker — see the note on `messages.getMessageInternal`. */
export async function getLeadInternal(id: string) {
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) throw AppError.notFound(`Lead ${id} not found`);
  return lead;
}
