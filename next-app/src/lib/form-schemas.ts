import { z } from "zod";

export const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  price: z.coerce.number().positive("Price must be positive").optional(),
  category: z.enum(["website", "menu", "other"]),
});
export type ProductInput = z.infer<typeof productSchema>;

export const newSearchSchema = z.object({
  name: z.string().min(1, "Name is required"),
  bizType: z.string().min(1, "Business type is required"),
  area: z.string().min(1, "Area is required"),
});
export type NewSearchInput = z.infer<typeof newSearchSchema>;

export const templateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  body: z.string().min(1, "Template body is required"),
  productId: z.string().min(1, "Select a product"),
});
export type TemplateInput = z.infer<typeof templateSchema>;
