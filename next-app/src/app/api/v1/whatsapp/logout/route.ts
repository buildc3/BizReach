import * as whatsapp from "@/lib/services/whatsapp";
import { ok, withRoute } from "@/lib/errors";

/** Disconnects WhatsApp and wipes the saved credentials (forces new QR scan). */
export const POST = withRoute(async () => {
  await whatsapp.logout();
  return ok("logged out");
});
