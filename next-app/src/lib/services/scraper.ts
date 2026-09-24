/**
 * Business discovery via Google Places Text Search + Place Details.
 *
 * Flow: Text Search finds up to 20 businesses matching `bizType` in `area`.
 * Place Details fills in phone and website for each result.
 * Email is best-effort scraped from the business website (no Places field).
 */
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { mapWithConcurrency } from "@/lib/concurrency";
import type { InsertLead } from "@/lib/repo/leads";

const USER_AGENT = "lead-gen-app/0.1 (local outreach tool)";
const TEXT_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json";
const DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json";

interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  geometry: { location: { lat: number; lng: number } };
}

interface TextSearchResponse {
  results?: PlaceResult[];
  status: string;
  error_message?: string;
}

interface PlaceDetails {
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  url?: string;
}

interface DetailsResponse {
  result?: PlaceDetails;
  status: string;
}

export async function searchBusinesses(searchId: string, bizType: string, area: string): Promise<InsertLead[]> {
  if (!env.GOOGLE_PLACES_API_KEY || env.GOOGLE_PLACES_API_KEY === "your_key_here") {
    throw AppError.scraper("GOOGLE_PLACES_API_KEY is not configured");
  }

  const query = `${bizType.trim()} in ${area.trim()}`;
  const places = await textSearch(query);

  const leads = await mapWithConcurrency(places, 5, async (place): Promise<InsertLead> => {
    const details = await placeDetails(place.place_id);

    const phone = details?.formatted_phone_number ?? details?.international_phone_number ?? null;
    const website = details?.website ?? null;
    const mapsUrl =
      details?.url ?? `https://www.google.com/maps/search/?api=1&query_place_id=${place.place_id}`;

    return {
      searchId,
      name: place.name,
      ownerName: null,
      address: place.formatted_address ?? null,
      phone,
      email: null,
      website,
      mapsUrl,
      lat: place.geometry.location.lat,
      lon: place.geometry.location.lng,
      source: "google_places",
    };
  });

  const deduped = dedupe(leads);
  await enrichEmails(deduped);
  return deduped;
}

async function textSearch(query: string): Promise<PlaceResult[]> {
  const url = new URL(TEXT_SEARCH_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("key", env.GOOGLE_PLACES_API_KEY);

  let resp: TextSearchResponse;
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(30_000) });
    resp = await res.json();
  } catch (e) {
    throw AppError.scraper(`Places text search request failed: ${e}`);
  }

  if (resp.status !== "OK" && resp.status !== "ZERO_RESULTS") {
    throw AppError.scraper(`Places API error: ${resp.status} — ${resp.error_message ?? ""}`);
  }

  return resp.results ?? [];
}

async function placeDetails(placeId: string): Promise<PlaceDetails | undefined> {
  try {
    const url = new URL(DETAILS_URL);
    url.searchParams.set("place_id", placeId);
    url.searchParams.set("fields", "formatted_phone_number,international_phone_number,website,url");
    url.searchParams.set("key", env.GOOGLE_PLACES_API_KEY);

    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const resp: DetailsResponse = await res.json();
    if (resp.status !== "OK") return undefined;
    return resp.result;
  } catch {
    return undefined;
  }
}

function dedupe(leads: InsertLead[]): InsertLead[] {
  const seen = new Set<string>();
  return leads.filter((l) => {
    const key = l.phone ?? l.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function enrichEmails(leads: InsertLead[]): Promise<void> {
  await mapWithConcurrency(leads, 5, async (lead) => {
    if (lead.email || !lead.website) return;
    lead.email = await scrapeEmail(lead.website);
  });
}

async function scrapeEmail(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    const html = await res.text();
    const match = html.match(/href\s*=\s*["']mailto:([^"'?]+)/i);
    const email = match?.[1]?.trim();
    return email && email.includes("@") ? email : null;
  } catch {
    return null;
  }
}
