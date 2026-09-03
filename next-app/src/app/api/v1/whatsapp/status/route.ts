import { NextRequest } from "next/server";
import * as whatsapp from "@/lib/services/whatsapp";
import { ok, withRoute } from "@/lib/errors";
import { requireUser } from "@/lib/auth";

/** Returns sidecar connection state and QR data URL (if waiting for scan). */
export const GET = withRoute(async (req: NextRequest) => {
  await requireUser(req);
  const status = await whatsapp.getStatus();
  return ok({ connected: status.connected, qr: status.qr });
});
