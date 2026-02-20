import cors from "cors";
import Busboy from "busboy";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { customAlphabet } from "nanoid";
import cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  FILE_CHUNK_SIZE,
  MAX_FILE_BYTES,
  MAX_PASTE_BYTES,
  createFileInitSchema,
  createPasteSchema,
  fileCompleteSchema,
  fileMetadataSchema,
  filePresignSchema,
  pasteRecordSchema,
  type FileMetadata
} from "@solun/shared";
import { runFileCleanup } from "./file-cleanup.js";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(3001),
  FRONTEND_URL: z.string().url(),
  ENCRYPTION_SECRET: z.string().min(32),
  R2_ENDPOINT: z.string().url(),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
  R2_REGION: z.string().default("auto"),
  // Optional comma-separated extra origins, e.g. "https://www.solun.pm,https://dev.solun.pm"
  EXTRA_ORIGINS: z.string().optional()
});

const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  PORT: process.env.PORT ?? "3001",
  FRONTEND_URL: process.env.FRONTEND_URL,
  ENCRYPTION_SECRET: process.env.ENCRYPTION_SECRET,
  R2_ENDPOINT: process.env.R2_ENDPOINT,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  R2_BUCKET: process.env.R2_BUCKET,
  R2_REGION: process.env.R2_REGION ?? "auto",
  EXTRA_ORIGINS: process.env.EXTRA_ORIGINS
});

// Derive a 32-byte key from the secret (truncate or pad to exactly 32 bytes)
const encryptionKey = Buffer.from(env.ENCRYPTION_SECRET.padEnd(32, "0").slice(0, 32), "utf8");
const FILE_UPLOAD_PART_SIZE = FILE_CHUNK_SIZE;
const FILE_UPLOAD_MAX_BYTES = MAX_FILE_BYTES;
const FILE_METADATA_SUFFIX = "metadata.json";
const PRESIGN_EXPIRES_SECONDS = 60 * 15;

const r2Client = new S3Client({
  region: env.R2_REGION,
  endpoint: env.R2_ENDPOINT,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY
  },
  forcePathStyle: true
});

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

function encryptFileKey(rawKey: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(rawKey), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

function decryptFileKey(stored: string): Buffer {
  const parts = stored.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid file key payload.");
  }
  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
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
      // Allow localhost during development without needing CORS config
      if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    }
  })
);
app.use(express.json({ limit: "512kb" }));

app.use((req, _res, next) => {
  if (req.path.startsWith("/api/files")) {
    console.log(
      `[files] ${req.method} ${req.path} origin=${req.headers.origin ?? "n/a"} ua=${req.headers["user-agent"] ?? "n/a"}`
    );
  }
  next();
});

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false
});

const fileLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false
});

const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const nanoidQuick = customAlphabet(alphabet, 5);
const nanoidSecure = customAlphabet(alphabet, 8);
const nanoidFileQuick = customAlphabet(alphabet, 5);
const nanoidFileSecure = customAlphabet(alphabet, 10);

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

function fileTtlToMs(value: string): number {
  switch (value) {
    case "1h":
      return 60 * 60 * 1000;
    case "24h":
      return 24 * 60 * 60 * 1000;
    case "7d":
      return 7 * 24 * 60 * 60 * 1000;
    default:
      return 60 * 60 * 1000;
  }
}

async function generateFileId(mode: "quick" | "secure"): Promise<string> {
  const generate = mode === "quick" ? nanoidFileQuick : nanoidFileSecure;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generate();
    const existing = await prisma.sharedFile.findUnique({
      where: { shortId: candidate },
      select: { shortId: true }
    });
    if (!existing) {
      return candidate;
    }
  }
  throw new Error("Unable to generate unique file id");
}

function buildFileKeys(): { r2Key: string; metadataKey: string } {
  const token = randomBytes(16).toString("hex");
  const prefix = `files/${token}`;
  return {
    r2Key: `${prefix}/data`,
    metadataKey: `${prefix}/${FILE_METADATA_SUFFIX}`
  };
}

async function createMultipartUpload(r2Key: string, contentType: string): Promise<string> {
  const response = await r2Client.send(
    new CreateMultipartUploadCommand({
      Bucket: env.R2_BUCKET,
      Key: r2Key,
      ContentType: contentType
    })
  );
  if (!response.UploadId) {
    throw new Error("Missing uploadId from R2.");
  }
  return response.UploadId;
}

async function abortMultipartUpload(r2Key: string, uploadId: string): Promise<void> {
  await r2Client.send(
    new AbortMultipartUploadCommand({
      Bucket: env.R2_BUCKET,
      Key: r2Key,
      UploadId: uploadId
    })
  );
}

async function completeMultipartUpload(
  r2Key: string,
  uploadId: string,
  parts: { partNumber: number; etag: string }[]
): Promise<void> {
  await r2Client.send(
    new CompleteMultipartUploadCommand({
      Bucket: env.R2_BUCKET,
      Key: r2Key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.map((part) => ({
          ETag: part.etag,
          PartNumber: part.partNumber
        }))
      }
    })
  );
}

async function putMetadataObject(metadataKey: string, metadata: FileMetadata): Promise<void> {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: metadataKey,
      Body: JSON.stringify(metadata),
      ContentType: "application/json"
    })
  );
}

async function deleteFileObjects(r2Key: string, metadataKey: string): Promise<void> {
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: r2Key
    })
  );
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: metadataKey
    })
  );
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

app.post("/api/files/initiate", fileLimiter, async (req, res) => {
  const parsed = createFileInitSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request." });
  }

  const payload = parsed.data;
  if (payload.sizeBytes > FILE_UPLOAD_MAX_BYTES) {
    return res.status(413).json({ error: "File exceeds 500MB limit." });
  }

  const expiresAt = new Date(Date.now() + fileTtlToMs(payload.expiresIn));
  const maxDownloads = payload.mode === "quick" ? 1 : payload.burnAfterRead ? 1 : null;

  try {
    const shortId = await generateFileId(payload.mode);
    const { r2Key, metadataKey } = buildFileKeys();
    const uploadId = await createMultipartUpload(r2Key, payload.contentType);

    await prisma.sharedFile.create({
      data: {
        shortId,
        mode: payload.mode,
        status: "pending",
        sizeBytes: payload.sizeBytes,
        contentType: payload.contentType,
        originalName: payload.originalName,
        r2Key,
        metadataKey,
        uploadId,
        maxDownloads,
        expiresAt
      }
    });

    return res.status(201).json({
      id: shortId,
      uploadId,
      r2Key,
      metadataKey,
      partSize: FILE_UPLOAD_PART_SIZE,
      expiresAt: expiresAt.toISOString()
    });
  } catch (error) {
    console.error("Initiate file upload failed:", error instanceof Error ? error.message : "unknown error");
    return res.status(500).json({ error: "Failed to initiate upload." });
  }
});

app.post("/api/files/presign", fileLimiter, async (req, res) => {
  const parsed = filePresignSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request." });
  }

  const payload = parsed.data;
  try {
    const record = await prisma.sharedFile.findUnique({
      where: { shortId: payload.id }
    });
    if (!record || record.status !== "pending") {
      return res.status(404).json({ error: "Upload not found." });
    }
    if (record.uploadId !== payload.uploadId) {
      return res.status(400).json({ error: "Invalid upload session." });
    }
    if (isExpired(record.expiresAt)) {
      await prisma.sharedFile.delete({ where: { shortId: payload.id } }).catch(() => undefined);
      return res.status(404).json({ error: "Upload expired." });
    }

    const urls = await Promise.all(
      payload.partNumbers.map(async (partNumber) => {
        const url = await getSignedUrl(
          r2Client,
          new UploadPartCommand({
            Bucket: env.R2_BUCKET,
            Key: record.r2Key,
            UploadId: payload.uploadId,
            PartNumber: partNumber
          }),
          { expiresIn: PRESIGN_EXPIRES_SECONDS }
        );
        return { partNumber, url };
      })
    );

    console.log(`[files] presign id=${payload.id} parts=${payload.partNumbers.join(",")}`);
    return res.json({ urls });
  } catch (error) {
    console.error("Presign failed:", error instanceof Error ? error.message : "unknown error");
    return res.status(500).json({ error: "Failed to presign URLs." });
  }
});

app.post("/api/files/complete", fileLimiter, async (req, res) => {
  const parsed = fileCompleteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request." });
  }

  const payload = parsed.data;
  try {
    const record = await prisma.sharedFile.findUnique({
      where: { shortId: payload.id }
    });
    if (!record || record.status !== "pending") {
      return res.status(404).json({ error: "Upload not found." });
    }
    if (record.uploadId !== payload.uploadId) {
      return res.status(400).json({ error: "Invalid upload session." });
    }

    const sortedParts = [...payload.parts].sort((a, b) => a.partNumber - b.partNumber);
    await completeMultipartUpload(record.r2Key, payload.uploadId, sortedParts);

    await prisma.sharedFile.update({
      where: { shortId: payload.id },
      data: { status: "active" }
    });

    return res.json({ ok: true });
  } catch (error) {
    console.error("Complete upload failed:", error instanceof Error ? error.message : "unknown error");
    return res.status(500).json({ error: "Failed to complete upload." });
  }
});

app.post("/api/files/metadata", fileLimiter, async (req, res) => {
  const parsed = fileMetadataSchema.safeParse(req.body?.metadata);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request." });
  }
  if (parsed.data.ivs.length !== parsed.data.totalChunks) {
    return res.status(400).json({ error: "Invalid metadata." });
  }
  const { id } = req.body as { id?: string };
  if (!id) {
    return res.status(400).json({ error: "Invalid request." });
  }

  try {
    const record = await prisma.sharedFile.findUnique({
      where: { shortId: id }
    });
    if (!record) {
      return res.status(404).json({ error: "File not found." });
    }
    await putMetadataObject(record.metadataKey, parsed.data);
    return res.json({ ok: true });
  } catch (error) {
    console.error("Store metadata failed:", error instanceof Error ? error.message : "unknown error");
    return res.status(500).json({ error: "Failed to store metadata." });
  }
});

app.post("/api/files/quick", fileLimiter, async (req, res) => {
    const busboy = Busboy({ headers: req.headers, limits: { fileSize: FILE_UPLOAD_MAX_BYTES } });
  let expiresIn: string = "24h";
  let uploadId: string | null = null;
  let shortId: string | null = null;
  let r2Key: string | null = null;
  let metadataKey: string | null = null;
  let originalName = "file";
  let contentType = "application/octet-stream";
  let sizeBytes = 0;
  let uploadError: Error | null = null;
  const ivs: string[] = [];
  const parts: { partNumber: number; etag: string }[] = [];
  const buffers: Buffer[] = [];
  let bufferedBytes = 0;
  let partNumber = 1;
  const fileKey = randomBytes(32);
  const encryptedKey = encryptFileKey(fileKey);
  let uploadQueue = Promise.resolve();
  let initPromise: Promise<void> | null = null;

  function queueUpload(chunk: Buffer): void {
    uploadQueue = uploadQueue.then(async () => {
      if (!initPromise) {
        initPromise = (async () => {
          const parsed = createFileInitSchema.safeParse({
            mode: "quick",
            expiresIn,
            sizeBytes: 1,
            contentType: "application/octet-stream",
            originalName: "file"
          });
          if (!parsed.success) {
            throw new Error("Invalid expiration.");
          }

          shortId = await generateFileId("quick");
          const keys = buildFileKeys();
          r2Key = keys.r2Key;
          metadataKey = keys.metadataKey;
          uploadId = await createMultipartUpload(r2Key, contentType);
          const expiresAt = new Date(Date.now() + fileTtlToMs(expiresIn));

          await prisma.sharedFile.create({
            data: {
              shortId,
              mode: "quick",
              status: "pending",
              sizeBytes: 0,
              contentType,
              originalName,
              r2Key,
              metadataKey,
              uploadId,
              maxDownloads: 1,
              expiresAt
            }
          });
        })();
      }

      await initPromise;
      if (!r2Key || !uploadId) {
        throw new Error("Upload not initialized.");
      }
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", fileKey, iv);
      const encrypted = Buffer.concat([cipher.update(chunk), cipher.final(), cipher.getAuthTag()]);
      const response = await r2Client.send(
        new UploadPartCommand({
          Bucket: env.R2_BUCKET,
          Key: r2Key,
          UploadId: uploadId,
          PartNumber: partNumber,
          Body: encrypted
        })
      );
      if (!response.ETag) {
        throw new Error("Missing ETag from upload part.");
      }
      ivs.push(iv.toString("base64"));
      parts.push({ partNumber, etag: response.ETag });
      partNumber += 1;
    });
  }

  function drainBuffer(force = false): void {
    if (bufferedBytes === 0) return;
    const combined = Buffer.concat(buffers, bufferedBytes);
    let offset = 0;
    while (combined.length - offset >= FILE_UPLOAD_PART_SIZE) {
      const slice = combined.subarray(offset, offset + FILE_UPLOAD_PART_SIZE);
      queueUpload(slice);
      offset += FILE_UPLOAD_PART_SIZE;
    }

    const remaining = combined.length - offset;
    buffers.length = 0;
    bufferedBytes = 0;
    if (remaining > 0) {
      if (force) {
        queueUpload(combined.subarray(offset));
      } else {
        buffers.push(combined.subarray(offset));
        bufferedBytes = remaining;
      }
    }
  }

  busboy.on("field", (name, value) => {
    if (name === "expiresIn") {
      expiresIn = value;
    }
  });

  busboy.on("file", (_name, file, info) => {
    originalName = info.filename ?? "file";
    contentType = info.mimeType || "application/octet-stream";

    file.on("data", (data) => {
      sizeBytes += data.length;
      buffers.push(data);
      bufferedBytes += data.length;

      if (bufferedBytes >= FILE_UPLOAD_PART_SIZE) {
        file.pause();
        drainBuffer(false);
        uploadQueue
          .then(() => {
            file.resume();
          })
          .catch((err) => {
            uploadError = err instanceof Error ? err : new Error("Upload failed.");
            file.destroy(uploadError);
          });
      }
    });

    file.on("limit", () => {
      uploadError = new Error("File exceeds 500MB limit.");
      file.destroy(uploadError);
    });

    file.on("end", () => {
      drainBuffer(true);
    });
  });

  busboy.on("finish", async () => {
    try {
      if (uploadError) {
        throw uploadError;
      }
      if (initPromise) {
        await initPromise;
      }
      if (!shortId || !uploadId || !r2Key || !metadataKey) {
        throw new Error("Missing upload data.");
      }
      if (sizeBytes <= 0) {
        throw new Error("Empty upload.");
      }

      await uploadQueue;

      const metadata: FileMetadata = {
        chunkSize: FILE_UPLOAD_PART_SIZE,
        totalSize: sizeBytes,
        totalChunks: ivs.length,
        ivs
      };

      await completeMultipartUpload(r2Key, uploadId, parts);
      await putMetadataObject(metadataKey, metadata);

      await prisma.sharedFile.update({
        where: { shortId },
        data: {
          status: "active",
          encryptedKey,
          sizeBytes
        }
      });

      return res.status(201).json({
        id: shortId,
        expiresAt: (await prisma.sharedFile.findUnique({ where: { shortId } }))?.expiresAt?.toISOString() ?? null
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      console.error("Quick upload failed:", message);
      if (r2Key && uploadId) {
        await abortMultipartUpload(r2Key, uploadId).catch(() => undefined);
      }
      if (shortId) {
        await prisma.sharedFile.delete({ where: { shortId } }).catch(() => undefined);
      }
      const status = message === "Invalid expiration." || message === "Empty upload." ? 400 : 500;
      return res.status(status).json({ error: "Failed to upload file." });
    }
  });

  busboy.on("error", (err) => {
    uploadError = err instanceof Error ? err : new Error("Upload failed.");
  });

  req.pipe(busboy);
});

app.get("/api/files/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const record = await prisma.sharedFile.findUnique({
      where: { shortId: id }
    });
    if (!record || record.status !== "active") {
      return res.status(404).json({ error: "Not found." });
    }

    if (isExpired(record.expiresAt)) {
      await deleteFileObjects(record.r2Key, record.metadataKey).catch(() => undefined);
      await prisma.sharedFile.delete({ where: { shortId: id } }).catch(() => undefined);
      return res.status(404).json({ error: "Not found." });
    }

    if (record.maxDownloads && record.downloadCount >= record.maxDownloads) {
      await deleteFileObjects(record.r2Key, record.metadataKey).catch(() => undefined);
      await prisma.sharedFile.delete({ where: { shortId: id } }).catch(() => undefined);
      return res.status(404).json({ error: "Not found." });
    }

    const downloadUrl = await getSignedUrl(
      r2Client,
      new GetObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: record.r2Key
      }),
      { expiresIn: PRESIGN_EXPIRES_SECONDS }
    );
    const metadataUrl = await getSignedUrl(
      r2Client,
      new GetObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: record.metadataKey
      }),
      { expiresIn: PRESIGN_EXPIRES_SECONDS }
    );

    const fileKey =
      record.mode === "quick" && record.encryptedKey
        ? decryptFileKey(record.encryptedKey).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
        : null;

    return res.json({
      id: record.shortId,
      mode: record.mode,
      sizeBytes: record.sizeBytes,
      contentType: record.contentType,
      originalName: record.originalName,
      expiresAt: record.expiresAt.toISOString(),
      maxDownloads: record.maxDownloads,
      downloadCount: record.downloadCount,
      downloadUrl,
      metadataUrl,
      fileKey
    });
  } catch (error) {
    console.error("File fetch failed:", error instanceof Error ? error.message : "unknown error");
    return res.status(500).json({ error: "Failed to retrieve file." });
  }
});

// HEAD /api/files/:id — check existence without downloading
app.head("/api/files/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const record = await prisma.sharedFile.findUnique({
      where: { shortId: id },
      select: {
        shortId: true,
        status: true,
        expiresAt: true,
        maxDownloads: true,
        downloadCount: true,
        r2Key: true,
        metadataKey: true
      }
    });

    if (!record || record.status !== "active") {
      return res.status(404).end();
    }

    if (isExpired(record.expiresAt)) {
      await deleteFileObjects(record.r2Key, record.metadataKey).catch(() => undefined);
      await prisma.sharedFile.delete({ where: { shortId: id } }).catch(() => undefined);
      return res.status(404).end();
    }

    if (record.maxDownloads && record.downloadCount >= record.maxDownloads) {
      await deleteFileObjects(record.r2Key, record.metadataKey).catch(() => undefined);
      await prisma.sharedFile.delete({ where: { shortId: id } }).catch(() => undefined);
      return res.status(404).end();
    }

    return res.status(200).end();
  } catch {
    return res.status(500).end();
  }
});

app.post("/api/files/:id/downloaded", async (req, res) => {
  const { id } = req.params;
  try {
    const updated = await prisma.sharedFile.update({
      where: { shortId: id },
      data: { downloadCount: { increment: 1 } }
    });

    if (updated.maxDownloads && updated.downloadCount >= updated.maxDownloads) {
      await deleteFileObjects(updated.r2Key, updated.metadataKey).catch(() => undefined);
      await prisma.sharedFile.delete({ where: { shortId: id } }).catch(() => undefined);
    }

    return res.json({ ok: true });
  } catch {
    return res.status(404).json({ error: "Not found." });
  }
});

app.delete("/api/files/:id", async (req, res) => {
  const { id } = req.params;
  const record = await prisma.sharedFile.findUnique({
    where: { shortId: id }
  });
  if (record) {
    await deleteFileObjects(record.r2Key, record.metadataKey).catch(() => undefined);
    await prisma.sharedFile.delete({ where: { shortId: id } }).catch(() => undefined);
  }
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

const FILE_CLEANUP_INTERVAL_MS = 15 * 60 * 1000;
setInterval(() => {
  void runFileCleanup({ prisma, r2Client, bucket: env.R2_BUCKET });
}, FILE_CLEANUP_INTERVAL_MS);
void runFileCleanup({ prisma, r2Client, bucket: env.R2_BUCKET });

app.listen(env.PORT, () => {
  console.log(`Solun API listening on ${env.PORT}`);
});
