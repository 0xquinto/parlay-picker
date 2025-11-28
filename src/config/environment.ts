import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z
  .object({
    SUPABASE_URL: z
      .string()
      .url()
      .refine(
        (val) => val.startsWith("postgres://") || val.startsWith("postgresql://"),
        { message: "must be a Postgres connection string (postgres:// or postgresql://)" },
      ),
    SUPABASE_DIRECT_URL: z.string().min(10),
    SUPABASE_KEY: z.string().min(10),
    EXA_API_KEY: z.string().min(10),
    OPENROUTER_API_KEY: z.string().min(10),
    GOOGLE_SHEETS_CREDENTIALS: z.string().min(1),
    GOOGLE_SHEET_ID: z.string().min(1),
    SPORTS_API_URL: z.string().url(),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).default(3000),
    CRON_SCHEDULE: z.string().default("0 6 * * *"),
  });

const parseResult = EnvSchema.safeParse(process.env);

if (!parseResult.success) {
  const issues = parseResult.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  throw new Error(`Invalid environment configuration: ${issues}`);
}

export const env = parseResult.data;

export type Environment = z.infer<typeof EnvSchema>;

export const isProduction = env.NODE_ENV === "production";
