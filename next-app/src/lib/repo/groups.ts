import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";

export async function getGroups(searchId: string, userId: string) {
  return prisma.group.findMany({
    where: { searchId, search: { userId } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function getGroup(id: string, userId: string) {
  const group = await prisma.group.findFirst({ where: { id, search: { userId } } });
  if (!group) throw AppError.notFound(`Group ${id} not found`);
  return group;
}

/** Caller must have already verified `searchId` belongs to this user (e.g. via searchesRepo.getSearch). */
export async function insertGroup(searchId: string, name: string, kind: string, sortOrder: number) {
  return prisma.group.create({ data: { searchId, name, kind, sortOrder } });
}

export async function renameGroup(id: string, userId: string, name: string) {
  const group = await getGroup(id, userId);
  return prisma.group.update({ where: { id: group.id }, data: { name } });
}

export async function deleteGroup(id: string, userId: string) {
  const group = await getGroup(id, userId);
  // ON DELETE SET NULL on leads.group_id (DB-level FK) keeps the leads, just ungroups them.
  await prisma.group.delete({ where: { id: group.id } });
}

/** Moves a lead into a group (or ungroups it when `groupId` is null). Verifies both the lead and the target group belong to `userId`. */
export async function setLeadGroup(leadId: string, groupId: string | null, userId: string) {
  if (groupId) await getGroup(groupId, userId); // throws notFound if the group isn't this user's
  const res = await prisma.lead.updateMany({ where: { id: leadId, userId }, data: { groupId } });
  if (res.count === 0) throw AppError.notFound(`Lead ${leadId} not found`);
  return prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
}

export async function getLeadsInGroup(groupId: string, userId: string) {
  await getGroup(groupId, userId); // ownership check
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
export async function autoGroupByContact(searchId: string, userId: string) {
  for (const [i, bucket] of BUCKETS.entries()) {
    const where: Prisma.LeadWhereInput = { searchId, userId, groupId: null, ...bucket.predicate };
    const hasAny = (await prisma.lead.count({ where })) > 0;
    if (!hasAny) continue;

    let group = await prisma.group.findFirst({ where: { searchId, kind: bucket.kind } });
    if (!group) {
      group = await insertGroup(searchId, bucket.name, bucket.kind, i);
    }

    await prisma.lead.updateMany({ where, data: { groupId: group.id } });
  }

  return getGroups(searchId, userId);
}
