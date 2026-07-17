import { z } from "zod";
import { AppError } from "@/lib/errors";

const uuid = z.string().uuid();

/** Validates a route param is a UUID (mirrors axum's `Path<Uuid>` extractor, which 400s on malformed IDs). */
export function parseUuid(value: string, label = "id"): string {
  if (!uuid.safeParse(value).success) {
    throw AppError.validation(`Invalid ${label}: ${value}`);
  }
  return value;
}

export const createSearchSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  bizType: z.string().trim().min(1, "Business type is required"),
  area: z.string().trim().min(1, "Area is required"),
});

export const createGroupSchema = z.object({
  searchId: uuid,
  name: z.string().trim().min(1, "Group name is required"),
});

export const renameGroupSchema = z.object({
  name: z.string().trim().min(1, "Group name is required"),
});

export const moveLeadSchema = z.object({
  groupId: uuid.nullable(),
});

export const productSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().nullish(),
  price: z.number().nullish(),
  category: z.string().trim().min(1, "Category is required"),
  active: z.boolean().default(true),
});

export const aiFillSchema = z.object({
  rawDescription: z.string().trim().min(1, "rawDescription is required"),
});

export const templateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  body: z.string().trim().min(1, "Body is required"),
  productId: uuid.nullish(),
});

export const generateTemplateSchema = z.object({
  productId: uuid,
  description: z.string().trim().min(1, "description is required"),
});

export const generateBatchSchema = z.object({
  groupId: uuid,
  mode: z.enum(["template", "ai"], { message: "mode must be 'template' or 'ai'" }),
  templateId: uuid.nullish(),
  productId: uuid.nullish(),
  instructions: z.string().nullish(),
});

export const updatePitchSchema = z.object({
  body: z.string().trim().min(1, "Pitch body cannot be empty"),
});

export const sendGroupSchema = z.object({
  groupId: uuid,
});

export const generatePitchSchema = z.object({
  leadId: uuid,
  productId: uuid.nullish(),
  instructions: z.string().nullish(),
});

export const updateProfileSchema = z.object({
  yourName: z.string().nullish(),
  companyName: z.string().nullish(),
  phone: z.string().nullish(),
  website: z.string().nullish(),
});
