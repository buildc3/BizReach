import { ok, withRoute } from "@/lib/errors";
import { clearAuthCookie } from "@/lib/auth";

export const POST = withRoute(async () => {
  const res = ok("logged out");
  clearAuthCookie(res);
  return res;
});
