/**
 * AI-generated outreach pitches via the Google Gemini API.
 *
 * Uses Gemini's OpenAI-compatible chat-completions endpoint. The API key
 * loads from env and is sent as a Bearer token — never hardcoded, never logged.
 */
import type { Lead, Product, Search, SenderProfile } from "@/generated/prisma/client";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

const API_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const MAX_RETRIES = 2;

const SYSTEM_PROMPT =
  "You write friendly WhatsApp outreach messages for a local marketing " +
  "agency. Personalize to the business using the details provided. Keep the main message under 80 words, " +
  "warm and human, no marketing clichés, end with a soft question as a call to action. Then add a brief " +
  "signature with the sender's name, company, and contact if provided. Output ONLY the message text — " +
  "no preamble, no quotes, no subject line.";

interface ChatResponse {
  choices?: { message?: { content?: string } }[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Rate limits (429) and transient upstream errors (5xx) are worth retrying. */
const isRetryable = (status: number) => status === 429 || status >= 500;

async function callAI(body: Record<string, unknown>): Promise<string> {
  if (!env.GEMINI_API_KEY) {
    throw AppError.internal("GEMINI_API_KEY is not configured");
  }

  // Gemini 2.5 Flash "thinks" by default, which adds seconds per call; short
  // copywriting doesn't need it.
  const payload = JSON.stringify(
    env.GEMINI_MODEL.includes("flash") ? { reasoning_effort: "none", ...body } : body,
  );

  let res: Response | undefined;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      res = await fetch(API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.GEMINI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: payload,
      });
    } catch (e) {
      if (attempt === MAX_RETRIES) throw AppError.internal(`Gemini request failed: ${e}`);
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    if (res.ok || !isRetryable(res.status) || attempt === MAX_RETRIES) break;
    const retryAfter = Number(res.headers.get("retry-after"));
    await sleep(Math.min(retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt, 10_000));
  }

  if (!res!.ok) {
    const detail = await res!.text().catch(() => "");
    throw AppError.internal(`Gemini API returned ${res!.status}: ${detail}`);
  }

  let parsed: ChatResponse;
  try {
    parsed = await res!.json();
  } catch (e) {
    throw AppError.internal(`Failed to parse Gemini response: ${e}`);
  }

  return (parsed.choices?.[0]?.message?.content ?? "").trim();
}

/**
 * Generate a personalized outreach message for `lead`.
 * `product` scopes the offer; `instructions` adds extra tone/context.
 */
export async function generatePitch(
  lead: Lead,
  search: Search,
  product: Product | null | undefined,
  instructions: string | null | undefined,
  profile: SenderProfile | null | undefined,
): Promise<string> {
  let details = `Business name: ${lead.name}\nCategory: ${search.bizType}\nArea: ${search.area}`;
  if (lead.ownerName) details += `\nOwner name: ${lead.ownerName}`;
  if (lead.address) details += `\nAddress: ${lead.address}`;
  if (lead.website) details += `\nWebsite: ${lead.website}`;
  if (product) {
    details += `\n\nService we are offering: ${product.name}`;
    if (product.description) details += ` — ${product.description}`;
  }
  const extra = instructions?.trim();
  if (extra) details += `\nExtra instructions: ${extra}`;
  if (profile) {
    details += "\n\nSender info (use for the signature at the end):";
    if (profile.yourName) details += `\nName: ${profile.yourName}`;
    if (profile.companyName) details += `\nCompany: ${profile.companyName}`;
    if (profile.phone) details += `\nPhone: ${profile.phone}`;
    if (profile.website) details += `\nWebsite: ${profile.website}`;
  }

  const text = await callAI({
    model: env.GEMINI_MODEL,
    temperature: 0.9,
    max_tokens: 500,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Write an outreach message for this business:\n\n${details}` },
    ],
  });

  if (!text) throw AppError.internal("Gemini returned an empty message");
  return text;
}

export interface ProductFill {
  name: string;
  description: string;
  category: string;
}

/**
 * Given a rough product description, ask the AI to rephrase it into
 * clean marketing-ready name, description, and category.
 */
export async function fillProduct(raw: string): Promise<ProductFill> {
  const system =
    "You are a product copywriter for a local digital marketing agency. " +
    "Given a rough description of a service they offer, output a JSON object with these exact keys:\n" +
    "- name: short product name (2-5 words, title case)\n" +
    "- description: one punchy sentence describing the product's value for small business owners (max 25 words)\n" +
    '- category: exactly one of "website", "menu", or "other"\n\n' +
    "Output ONLY valid JSON. No markdown, no explanation, no extra text.";

  const rawJson = await callAI({
    model: env.GEMINI_MODEL,
    temperature: 0.4,
    max_tokens: 200,
    messages: [
      { role: "system", content: system },
      { role: "user", content: `Service description: ${raw}` },
    ],
  });

  const clean = rawJson.trim().replace(/^```json/, "").replace(/^```/, "").replace(/```$/, "").trim();

  try {
    return JSON.parse(clean) as ProductFill;
  } catch (e) {
    throw AppError.internal(`AI returned invalid JSON: ${e} — raw: ${clean}`);
  }
}

/**
 * AI-generate a reusable WhatsApp outreach template for `product`.
 * The product's name and description are auto-injected as context, and the
 * model is told to use the placeholder tokens the renderer understands.
 */
export async function generateTemplate(product: Product, description: string): Promise<string> {
  const system =
    "You write reusable WhatsApp outreach message templates for a local marketing " +
    "agency. A template is sent to many businesses, so insert these placeholder tokens where personal " +
    "details belong — they are filled in later: {business_name}, {owner_name}, {area}, {phone}, {website}. " +
    "Always include {business_name} and at least one other placeholder. Keep it under 60 words, warm and " +
    "human, no marketing clichés, and end with a soft question as a call to action. Output ONLY the " +
    "template text — no preamble, no quotes, no subject line.";

  let context = `Product/service being offered: ${product.name}`;
  if (product.description) context += ` — ${product.description}`;
  context += `\n\nTemplate goal / tone from the user: ${description}`;

  const text = await callAI({
    model: env.GEMINI_MODEL,
    temperature: 0.8,
    max_tokens: 400,
    messages: [
      { role: "system", content: system },
      { role: "user", content: context },
    ],
  });

  if (!text) throw AppError.internal("Gemini returned an empty template");
  return text;
}
