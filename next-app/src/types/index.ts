export type SearchStatus = "pending" | "running" | "done" | "error";
export type MessageStatus =
  | "draft"
  | "reviewed"
  | "rejected"
  | "queued"
  | "sent"
  | "delivered"
  | "replied"
  | "failed";
export type ProductCategory = "website" | "menu" | "other";

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  category: ProductCategory;
  active: boolean;
  createdAt: string;
}

export interface Search {
  id: string;
  name: string;
  bizType: string;
  area: string;
  status: SearchStatus;
  createdAt: string;
}

export type GroupKind = "has_email" | "phone_only" | "no_contact" | "manual";

export interface Group {
  id: string;
  searchId: string;
  name: string;
  kind: GroupKind;
  sortOrder: number;
  createdAt: string;
}

export interface Lead {
  id: string;
  searchId: string;
  groupId: string | null;
  name: string;
  ownerName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  mapsUrl: string | null;
  lat: number | null;
  lon: number | null;
  source: string | null;
  createdAt: string;
}

export interface Template {
  id: string;
  name: string;
  body: string;
  productId: string | null;
  createdAt: string;
}

export interface Message {
  id: string;
  leadId: string;
  templateId: string | null;
  body: string;
  status: MessageStatus;
  sentAt: string | null;
  reviewedAt: string | null;
  deliveredAt: string | null;
  repliedAt: string | null;
  createdAt: string;
}

/** A pitch (draft message) joined with its lead's display info, for review. */
export interface Pitch extends Message {
  leadName: string;
  leadPhone: string | null;
}

export type PitchMode = "template" | "ai";

export interface SenderProfile {
  id: string;
  yourName: string | null;
  companyName: string | null;
  phone: string | null;
  website: string | null;
  updatedAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface WhatsAppStatus {
  connected: boolean;
  qr: string | null;
}

export interface ApiError {
  success: false;
  code: "VALIDATION" | "NOT_FOUND" | "SCRAPER" | "WHATSAPP" | "DATABASE" | "INTERNAL";
  message: string;
}
