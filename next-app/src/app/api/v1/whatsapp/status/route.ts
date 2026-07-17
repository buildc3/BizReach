import * as whatsapp from "@/lib/services/whatsapp";
import { ok, withRoute } from "@/lib/errors";

/** Returns sidecar connection state and QR data URL (if waiting for scan). */
export const GET = withRoute(async () => {
  const status = await whatsapp.getStatus();
  return ok({ connected: status.connected, qr: status.qr });
});
