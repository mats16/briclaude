// apps/backend/drizzle.config.ts
import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';
import path from 'path';

// プロジェクトルートの .env ファイルを読み込む
config({ path: path.join(import.meta.dirname, '../../.env') });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in environment variables');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
});
