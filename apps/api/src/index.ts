import cors from "cors";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { customAlphabet } from "nanoid";
import cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { createPasteSchema, MAX_PASTE_BYTES, pasteRecordSchema } from "@solun/shared";

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(3001),
  FRONTEND_URL: z.string().url(),
  ENCRYPTION_SECRET: z.string().min(32),
  // Optional comma-separated extra origins, e.g. "https://www.solun.pm,https://dev.solun.pm"
  EXTRA_ORIGINS: z.string().optional()
});

const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  PORT: process.env.PORT ?? "3001",
  FRONTEND_URL: process.env.FRONTEND_URL,
  ENCRYPTION_SECRET: process.env.ENCRYPTION_SECRET
});

// Derive a 32-byte key from the secret (truncate or pad to exactly 32 bytes)
const encryptionKey = Buffer.from(env.ENCRYPTION_SECRET.padEnd(32, "0").slice(0, 32), "utf8");

function encryptContent(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: base64(iv):base64(tag):base64(ciphertext)
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

function decryptContent(stored: string): string {
  const parts = stored.split(":");
  if (parts.length !== 3) {
    // Not encrypted (legacy plain text), return as-is
    return stored;
  }
  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data).toString("utf8") + decipher.final("utf8");
}

const prisma = new PrismaClient();

const app = express();
app.disable("x-powered-by");

app.use(helmet());
const allowedOrigins = [
  env.FRONTEND_URL,
  ...(env.EXTRA_ORIGINS ? env.EXTRA_ORIGINS.split(",").map((o) => o.trim()) : [])
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. server-to-server, curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    }
  })
);
app.use(express.json({ limit: "512kb" }));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false
});

const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const nanoidQuick = customAlphabet(alphabet, 5);
const nanoidSecure = customAlphabet(alphabet, 8);

function isExpired(expiresAt: Date | null, now = new Date()): boolean {
  if (!expiresAt) return false;
  return expiresAt.getTime() <= now.getTime();
}

async function generateShortId(mode: "quick" | "secure"): Promise<string> {
  const generate = mode === "quick" ? nanoidQuick : nanoidSecure;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generate();
    const existing = await prisma.paste.findUnique({
      where: { shortId: candidate },
      select: { shortId: true }
    });
    if (!existing) {
      return candidate;
    }
  }
  throw new Error("Unable to generate unique id");
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/paste", limiter, async (req, res) => {
  const parsed = createPasteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request." });
  }

  const payload = parsed.data;
  const size = Buffer.byteLength(payload.content, "utf8");
  if (size > MAX_PASTE_BYTES) {
    return res.status(413).json({ error: "Paste exceeds 512KB limit." });
  }

  // "burn" = no time-based expiry, delete on first read
  const isBurnTtl = payload.ttl === "burn";
  const expiresAt =
    payload.ttl === null || isBurnTtl
      ? null
      : new Date(Date.now() + (payload.ttl as number) * 1000);

  // Quick pastes always burn after read (server-enforced)
  const burnAfterRead =
    payload.mode === "quick"
      ? true
      : (isBurnTtl || (payload.burnAfterRead ?? false));

  try {
    const shortId = await generateShortId(payload.mode);
    // Quick pastes are encrypted at rest with a server-side key (not E2E).
    // Secure pastes are already E2E encrypted by the client; store as-is.
    const storedContent =
      payload.mode === "quick" ? encryptContent(payload.content) : payload.content;

    const record = await prisma.paste.create({
      data: {
        shortId,
        content: storedContent,
        mode: payload.mode,
        iv: payload.mode === "secure" ? payload.iv ?? null : null,
        burnAfterRead,
        expiresAt
      }
    });

    return res.status(201).json({
      id: record.shortId,
      mode: record.mode,
      expiresAt: record.expiresAt ? record.expiresAt.toISOString() : null
    });
  } catch (error) {
    console.error(
      "Create paste failed:",
      error instanceof Error ? error.message : "unknown error"
    );
    return res.status(500).json({ error: "Failed to create paste." });
  }
});

// HEAD /api/paste/:id — check existence without reading or deleting
app.head("/api/paste/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const paste = await prisma.paste.findUnique({
      where: { shortId: id },
      select: { shortId: true, expiresAt: true }
    });
    if (!paste || isExpired(paste.expiresAt)) {
      return res.status(404).end();
    }
    return res.status(200).end();
  } catch {
    return res.status(500).end();
  }
});

app.get("/api/paste/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const paste = await prisma.paste.findUnique({
      where: { shortId: id }
    });

    if (!paste) {
      return res.status(404).json({ error: "Not found." });
    }

    if (isExpired(paste.expiresAt)) {
      await prisma.paste.delete({ where: { shortId: id } }).catch(() => undefined);
      return res.status(404).json({ error: "Not found." });
    }

    if (paste.burnAfterRead) {
      await prisma.paste.delete({ where: { shortId: id } }).catch(() => undefined);
    }

    // Quick pastes are stored encrypted at rest; decrypt before sending to client.
    // Secure pastes are E2E encrypted by the client; return ciphertext as-is.
    let content: string;
    try {
      content = paste.mode === "quick" ? decryptContent(paste.content) : paste.content;
    } catch (err) {
      console.error("Decryption failed for paste", id, err instanceof Error ? err.message : err);
      return res.status(500).json({ error: "Failed to decrypt paste. The server key may have changed." });
    }

    const response = {
      id: paste.shortId,
      content,
      mode: paste.mode,
      iv: paste.iv ?? null,
      expiresAt: paste.expiresAt ? paste.expiresAt.toISOString() : null,
      burnAfterRead: paste.burnAfterRead
    };

    const validated = pasteRecordSchema.safeParse(response);
    if (!validated.success) {
      return res.status(500).json({ error: "Invalid paste record." });
    }

    return res.json(validated.data);
  } catch (error) {
    console.error("Get paste failed:", error instanceof Error ? error.message : "unknown error");
    return res.status(500).json({ error: "Failed to retrieve paste." });
  }
});

app.delete("/api/paste/:id", async (req, res) => {
  const { id } = req.params;
  await prisma.paste.deleteMany({ where: { shortId: id } });
  return res.status(204).send();
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("API error:", err instanceof Error ? err.message : "unknown error");
  res.status(500).json({ error: "Internal server error." });
});

cron.schedule("0 * * * *", async () => {
  const now = new Date();
  await prisma.paste.deleteMany({
    where: {
      expiresAt: {
        lt: now
      }
    }
  });
});

app.listen(env.PORT, () => {
  console.log(`Solun API listening on ${env.PORT}`);
});
