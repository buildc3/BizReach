import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  GOOGLE_PLACES_API_KEY: z.string().default(""),
  GROQ_API_KEY: z.string().default(""),
  GROQ_MODEL: z.string().default("llama-3.3-70b-versatile"),
  SIDECAR_URL: z.string().default("http://127.0.0.1:3099"),
  SIDECAR_TOKEN: z.string().default(""),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
});

export const env = envSchema.parse(process.env);
