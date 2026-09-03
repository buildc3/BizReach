import { NextRequest } from "next/server";
import * as whatsapp from "@/lib/services/whatsapp";
import { ok, withRoute } from "@/lib/errors";
import { requireUser } from "@/lib/auth";

/** Disconnects WhatsApp and wipes the saved credentials (forces new QR scan). */
export const POST = withRoute(async (req: NextRequest) => {
  await requireUser(req);
  await whatsapp.logout();
  return ok("logged out");
});
