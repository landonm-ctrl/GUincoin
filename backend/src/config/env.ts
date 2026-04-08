import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().default('postgresql://localhost:5432/guincoin'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  BACKEND_URL: z.string().default('http://localhost:5000'),
  SESSION_SECRET: z.string().default('dev-secret-change-me'),

  // Google OAuth (optional)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_WORKSPACE_DOMAIN: z.string().optional(),

  // SMTP (optional)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  // OpenAI (optional)
  OPENAI_API_KEY: z.string().optional(),

  // File uploads
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE: z.coerce.number().default(5242880),

  // Rate limiting
  RATE_LIMIT_ENABLED: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  RATE_LIMIT_MAX: z.coerce.number().optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().optional(),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error('Invalid environment variables:');
  console.error(result.error.format());
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

// Use the parsed data if successful, otherwise fall back to raw parse (dev only)
const parsed = result.success ? result.data : envSchema.parse(process.env);

// Production-specific validation: fail fast if critical secrets are missing or insecure
if (parsed.NODE_ENV === 'production') {
  const fatal: string[] = [];

  if (parsed.SESSION_SECRET === 'dev-secret-change-me') {
    fatal.push('SESSION_SECRET must be changed from the default value in production');
  }
  if (parsed.DATABASE_URL === 'postgresql://localhost:5432/guincoin') {
    fatal.push('DATABASE_URL must be explicitly set in production');
  }
  if (parsed.FRONTEND_URL === 'http://localhost:5173') {
    fatal.push('FRONTEND_URL must be explicitly set in production');
  }
  if (parsed.BACKEND_URL === 'http://localhost:5000') {
    fatal.push('BACKEND_URL must be explicitly set in production');
  }

  if (fatal.length > 0) {
    console.error('FATAL: Production environment misconfigured:');
    for (const msg of fatal) {
      console.error(`  - ${msg}`);
    }
    process.exit(1);
  }
}

export const env = parsed;
