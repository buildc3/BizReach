import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@/generated/prisma/client";

export type ErrorCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "SCRAPER"
  | "WHATSAPP"
  | "DATABASE"
  | "INTERNAL"
  | "UNAUTHORIZED"
  | "CONFLICT";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AppError";
  }

  static validation(message: string) {
    return new AppError("VALIDATION", message, 400);
  }
  static notFound(message: string) {
    return new AppError("NOT_FOUND", message, 404);
  }
  static scraper(message: string) {
    return new AppError("SCRAPER", message, 502);
  }
  static whatsapp(message: string) {
    return new AppError("WHATSAPP", message, 502);
  }
  static internal(message: string) {
    return new AppError("INTERNAL", message, 500);
  }
  static unauthorized(message = "Not authenticated") {
    return new AppError("UNAUTHORIZED", message, 401);
  }
  static conflict(message: string) {
    return new AppError("CONFLICT", message, 409);
  }
}

/** Success envelope: { success: true, data }. */
export function ok<T>(data: T, init?: number) {
  return NextResponse.json({ success: true, data }, { status: init ?? 200 });
}

function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  if (err instanceof ZodError) {
    const message = err.issues.map((i) => i.message).join("; ");
    return AppError.validation(message);
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2025") return AppError.notFound("Record not found");
    return new AppError("DATABASE", err.message, 500);
  }

  if (err instanceof Error) return AppError.internal(err.message);

  return AppError.internal("Unknown error");
}

/** Error envelope: { success: false, code, message }. Mirrors backend/src/error.rs. */
export function errorResponse(err: unknown) {
  const appErr = toAppError(err);
  console.error(`[${appErr.code}]`, appErr.message);
  return NextResponse.json(
    { success: false, code: appErr.code, message: appErr.message },
    { status: appErr.status },
  );
}

/** Wraps a route handler so thrown AppError/ZodError/Prisma errors become the standard error envelope. */
export function withRoute<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>,
) {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (err) {
      return errorResponse(err);
    }
  };
}
