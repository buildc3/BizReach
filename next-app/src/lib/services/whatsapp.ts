import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

export interface SidecarStatus {
  connected: boolean;
  qr: string | null;
}

const UNREACHABLE = "Could not reach the local WhatsApp service. Make sure the sidecar is running.";
const UNAUTHORIZED = "WhatsApp service rejected the request. Check that SIDECAR_TOKEN matches the sidecar.";

/** Headers for every sidecar call, including the shared-secret token. */
function sidecarHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return env.SIDECAR_TOKEN ? { ...extra, "x-sidecar-token": env.SIDECAR_TOKEN } : extra;
}

/**
 * Normalise an Indian phone number to digits-only international format.
 * 10-digit → "91" + digits
 * Leading "0" + 10 digits → "91" + digits
 * Already has "91" prefix → unchanged
 */
function normalisePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 11) return `91${digits.slice(1)}`;
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

/** Send a WhatsApp message via the local Baileys sidecar. */
export async function sendMessage(phone: string, body: string): Promise<void> {
  const normalised = normalisePhone(phone);

  let res: Response;
  try {
    res = await fetch(`${env.SIDECAR_URL}/api/send`, {
      method: "POST",
      headers: sidecarHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ phone: normalised, message: body }),
    });
  } catch {
    throw AppError.whatsapp(UNREACHABLE);
  }

  if (res.status === 401) throw AppError.whatsapp(UNAUTHORIZED);

  if (res.status === 503) {
    throw AppError.whatsapp("WhatsApp is not connected. Please scan the QR code in Settings → WhatsApp.");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw AppError.whatsapp(err.error ?? "Unknown sidecar error");
  }
}

/** Proxy the sidecar's status (connected + QR data URL) to the frontend. */
export async function getStatus(): Promise<SidecarStatus> {
  let res: Response;
  try {
    res = await fetch(`${env.SIDECAR_URL}/api/status`, { headers: sidecarHeaders() });
  } catch {
    throw AppError.whatsapp(UNREACHABLE);
  }
  if (res.status === 401) throw AppError.whatsapp(UNAUTHORIZED);
  return res.json();
}

/** Disconnect WhatsApp and wipe saved credentials. */
export async function logout(): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${env.SIDECAR_URL}/api/logout`, { method: "POST", headers: sidecarHeaders() });
  } catch {
    throw AppError.whatsapp("Could not reach the local WhatsApp service.");
  }
  if (res.status === 401) throw AppError.whatsapp(UNAUTHORIZED);
}
