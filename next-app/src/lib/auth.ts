import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

export const AUTH_COOKIE = "lead_gen_session";
const TOKEN_TTL = "7d";
const secretKey = new TextEncoder().encode(env.JWT_SECRET);

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(secretKey);
}

/** Returns the userId (JWT `sub`) if the token is valid, otherwise null. Never throws. */
export async function verifyToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

/**
 * Reads and verifies the session cookie on a route handler request.
 * Throws AppError.unauthorized() if missing/invalid/expired — callers let
 * withRoute() convert that into the standard 401 envelope, same as any
 * other AppError.
 */
export async function requireUser(req: NextRequest): Promise<string> {
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (!token) throw AppError.unauthorized();
  const userId = await verifyToken(token);
  if (!userId) throw AppError.unauthorized("Session expired, please log in again");
  return userId;
}

/** Sets the httpOnly session cookie on a route handler's response (signup/login). */
export function setAuthCookie(res: NextResponse, token: string): void {
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days, matches TOKEN_TTL
  });
}

/** Clears the session cookie (logout). */
export function clearAuthCookie(res: NextResponse): void {
  res.cookies.delete(AUTH_COOKIE);
}
