import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('5000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  JWT_SECRET: z.string().default('bank_lms_super_secret_jwt_key_2026'),
  JWT_REFRESH_SECRET: z.string().default('bank_lms_super_secret_refresh_key_2026'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  DB_PATH: z.string().default(path.resolve(__dirname, '../../bank_exam.db')),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional().transform((val) => (val ? Number(val) : 587)),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('Bank LMS <no-reply@banklms.ac.bd>'),
  OTP_DELIVERY_MODE: z.enum(['smtp', 'console', 'test']).default(
    process.env.NODE_ENV === 'test' || process.env.VITEST ? 'test' : 'smtp'
  ),
  // SMS Gateway Configuration (Bangladesh SMS aggregators e.g., Onnorokom, SSL Wireless, Greenweb, etc.)
  SMS_GATEWAY_URL: z.string().optional(),
  SMS_API_KEY: z.string().optional(),
  SMS_SENDER_ID: z.string().default('BANKLMS'),
  SMS_DELIVERY_MODE: z.enum(['gateway', 'console', 'test']).default(
    process.env.NODE_ENV === 'test' || process.env.VITEST ? 'test' : 'gateway'
  ),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('[Config Error] Invalid environment configuration:', parsedEnv.error.format());
  process.exit(1);
}

export const config = parsedEnv.data;
