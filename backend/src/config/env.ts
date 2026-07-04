import { z } from "zod";

const booleanValue = z.enum(["true", "false"]).transform(value => value === "true");
const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  JWT_SECRET: z.string().min(32),
  DATA_ENCRYPTION_KEY: z.string(),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string().regex(/^[A-Za-z0-9_$-]+$/),
  DB_CONNECTION_LIMIT: z.coerce.number().int().min(2).max(50).default(10),
  DB_SSL: booleanValue.default(true),
  UPLOAD_ROOT: z.string().min(1).optional(),
  FRONTEND_ORIGIN: z.string().min(1).refine(
    value => value.split(",").every(origin => z.url().safeParse(origin.trim()).success),
    "must be a comma-separated list of valid URLs"
  ),
  ALLOW_PRODUCTION_MIGRATIONS: booleanValue.default(false)
});

export type AppConfig = z.infer<typeof schema>;
let cached: AppConfig | undefined;

export function getConfig(): AppConfig {
  if (cached) return cached;
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const message = result.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${message}`);
  }
  if (/^(your-|replace)/i.test(result.data.DB_HOST)) throw new Error("DB_HOST is still a placeholder.");
  if (!result.data.DATA_ENCRYPTION_KEY) throw new Error("DATA_ENCRYPTION_KEY is required.");
  if (Buffer.from(result.data.DATA_ENCRYPTION_KEY, "base64").length !== 32) throw new Error("DATA_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  cached = result.data;
  return cached;
}
