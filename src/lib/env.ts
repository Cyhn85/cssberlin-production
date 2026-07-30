import { z } from 'zod/v4';

/**
 * Environment variable validation for cssberlin.de
 * Validates env vars at startup to prevent runtime crashes.
 */

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL ist erforderlich'),
  DIRECT_URL: z.string().optional(),

  // Auth
  NEXTAUTH_SECRET: z.string().min(16, 'NEXTAUTH_SECRET muss mindestens 16 Zeichen lang sein'),
  NEXTAUTH_URL: z.string().url().optional(),

  // File Upload (UploadThing v7)
  UPLOADTHING_TOKEN: z.string().optional(),

  // Payment (Stripe)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Email (Resend)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  // Rate Limiting (Upstash Redis)
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Real-time (Pusher)
  PUSHER_APP_ID: z.string().optional(),
  PUSHER_KEY: z.string().optional(),
  PUSHER_SECRET: z.string().optional(),
  PUSHER_CLUSTER: z.string().optional(),

  // AI
  GROQ_API_KEY: z.string().optional(),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),

  // Monitoring
  SENTRY_DSN: z.string().optional(),

  // App
  NEXT_PUBLIC_APP_URL: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

function getEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('Invalid environment variables:');
    const formatted = parsed.error.issues.map(
      (issue) => `  -> ${issue.path.join('.')}: ${issue.message}`
    );
    console.error(formatted.join('\n'));

    if (process.env.NODE_ENV === 'production') {
      throw new Error('Missing environment variables. See logs.');
    }

    return process.env as unknown as z.infer<typeof envSchema>;
  }

  return parsed.data;
}

export const env = getEnv();

export const serviceReady = {
  stripe: () => !!env.STRIPE_SECRET_KEY,
  uploadthing: () => !!env.UPLOADTHING_TOKEN,
  email: () => !!env.RESEND_API_KEY,
  redis: () => !!env.UPSTASH_REDIS_REST_URL,
  pusher: () => !!env.PUSHER_APP_ID,
  ai: () => !!env.GROQ_API_KEY || !!env.GOOGLE_GENERATIVE_AI_API_KEY,
  sentry: () => !!env.SENTRY_DSN,
};