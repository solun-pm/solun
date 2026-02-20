import dotenv from "dotenv";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { S3Client } from "@aws-sdk/client-s3";
import { runFileCleanup } from "./file-cleanup";

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  R2_ENDPOINT: z.string().url(),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
  R2_REGION: z.string().default("auto")
});

const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  R2_ENDPOINT: process.env.R2_ENDPOINT,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  R2_BUCKET: process.env.R2_BUCKET,
  R2_REGION: process.env.R2_REGION ?? "auto"
});

const prisma = new PrismaClient();
const r2Client = new S3Client({
  region: env.R2_REGION,
  endpoint: env.R2_ENDPOINT,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY
  },
  forcePathStyle: true
});

async function main() {
  await runFileCleanup({ prisma, r2Client, bucket: env.R2_BUCKET });
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("File cleanup failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
