import "server-only";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url().default("http://localhost:3000"),
  ENVIRONMENT: z.string().default("production"),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASSWORD: z.string().optional().default(""),
  SMTP_SECURE: z.enum(["true", "false"]).default("false"),
  EMAIL_FROM: z.string().min(1),
  LLM_API_KEY: z.string().optional().default(""),
  LLM_BASE_URL: z.string().url().default("https://api.groq.com/openai/v1"),
  LLM_MODEL: z.string().min(1).default("llama-3.3-70b-versatile"),
});

let cached: z.infer<typeof schema> | undefined;
export function env() {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success)
      throw new Error(
        `Invalid environment configuration: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`,
      );
    cached = parsed.data;
  }
  return cached;
}
