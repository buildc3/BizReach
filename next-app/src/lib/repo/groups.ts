import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";

export async function getGroups(searchId: string) {
  return prisma.group.findMany({
    where: { searchId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function getGroup(id: string) {
  const group = await prisma.group.findUnique({ where: { id } });
  if (!group) throw AppError.notFound(`Group ${id} not found`);
  return group;
}

export async function insertGroup(searchId: string, name: string, kind: string, sortOrder: number) {
  return prisma.group.create({ data: { searchId, name, kind, sortOrder } });
}

export async function renameGroup(id: string, name: string) {
  return prisma.group.update({ where: { id }, data: { name } });
}

export async function deleteGroup(id: string) {
  // ON DELETE SET NULL on leads.group_id (DB-level FK) keeps the leads, just ungroups them.
  await prisma.group.delete({ where: { id } });
}

export async function setLeadGroup(leadId: string, groupId: string | null) {
  return prisma.lead.update({ where: { id: leadId }, data: { groupId } });
}

export async function getLeadsInGroup(groupId: string) {
  return prisma.lead.findMany({ where: { groupId }, orderBy: { createdAt: "asc" } });
}

interface Bucket {
  kind: string;
  name: string;
  predicate: Prisma.LeadWhereInput;
}

const BUCKETS: Bucket[] = [
  {
    kind: "has_email",
    name: "Has email + phone",
    predicate: {
      AND: [{ phone: { not: null } }, { phone: { not: "" } }, { email: { not: null } }, { email: { not: "" } }],
    },
  },
  {
    kind: "phone_only",
    name: "Phone only",
    predicate: {
      AND: [{ phone: { not: null } }, { phone: { not: "" } }, { OR: [{ email: null }, { email: "" }] }],
    },
  },
  {
    kind: "no_contact",
    name: "No phone",
    predicate: { OR: [{ phone: null }, { phone: "" }] },
  },
];

/**
 * Auto-group a search's still-ungrouped leads by contact channel.
 * Creates the standard buckets (only the non-empty ones) and assigns leads.
 * Leads the user has already placed in a group are left untouched.
 */
export async function autoGroupByContact(searchId: string) {
  for (const [i, bucket] of BUCKETS.entries()) {
    const where: Prisma.LeadWhereInput = { searchId, groupId: null, ...bucket.predicate };
    const hasAny = (await prisma.lead.count({ where })) > 0;
    if (!hasAny) continue;

    let group = await prisma.group.findFirst({ where: { searchId, kind: bucket.kind } });
    if (!group) {
      group = await insertGroup(searchId, bucket.name, bucket.kind, i);
    }

    await prisma.lead.updateMany({ where, data: { groupId: group.id } });
  }

  return getGroups(searchId);
}
