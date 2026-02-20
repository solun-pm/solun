import { z } from "zod";

export const MAX_PASTE_BYTES = 512 * 1024;
export const MAX_FILE_BYTES = 500 * 1024 * 1024;
export const FILE_CHUNK_SIZE = 10 * 1024 * 1024;

export const pasteModeSchema = z.enum(["quick", "secure"]);
export const fileModeSchema = z.enum(["quick", "secure"]);

export const fileExpirationSchema = z.enum(["1h", "24h", "7d"]);
export const fileStatusSchema = z.enum(["pending", "active", "expired"]);

export const ttlSchema = z.union([
  z.literal(3600),
  z.literal(86400),
  z.literal(604800),
  z.literal("burn"),
  z.null()
]);

export const createPasteSchema = z
  .object({
    content: z.string().min(1),
    mode: pasteModeSchema,
    ttl: ttlSchema,
    burnAfterRead: z.boolean().optional(),
    iv: z.string().optional()
  })
  .superRefine((value, context) => {
    if (value.mode === "secure") {
      if (!value.iv) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["iv"],
          message: "IV is required for secure pastes."
        });
      }
    } else {
      if (value.iv) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["iv"],
          message: "IV is only allowed for secure pastes."
        });
      }
      if (value.burnAfterRead) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["burnAfterRead"],
          message: "Burn-after-read is only allowed for secure pastes."
        });
      }
    }
  });

export const pasteResponseSchema = z.object({
  id: z.string(),
  mode: pasteModeSchema,
  expiresAt: z.string().datetime().nullable()
});

export const pasteRecordSchema = z.object({
  id: z.string(),
  content: z.string(),
  mode: pasteModeSchema,
  iv: z.string().nullable(),
  expiresAt: z.string().datetime().nullable(),
  burnAfterRead: z.boolean()
});

export const createFileInitSchema = z.object({
  mode: fileModeSchema,
  expiresIn: fileExpirationSchema,
  sizeBytes: z.number().int().positive().max(MAX_FILE_BYTES),
  contentType: z.string().min(1),
  originalName: z.string().min(1),
  burnAfterRead: z.boolean().optional()
});

export const filePresignSchema = z.object({
  id: z.string().min(1),
  uploadId: z.string().min(1),
  partNumbers: z.array(z.number().int().min(1)).min(1)
});

export const fileCompleteSchema = z.object({
  id: z.string().min(1),
  uploadId: z.string().min(1),
  parts: z.array(
    z.object({
      partNumber: z.number().int().min(1),
      etag: z.string().min(1)
    })
  )
});

export const fileMetadataSchema = z.object({
  chunkSize: z.number().int().positive(),
  totalSize: z.number().int().positive(),
  totalChunks: z.number().int().positive(),
  ivs: z.array(z.string().min(1))
});

export type FileMode = z.infer<typeof fileModeSchema>;
export type FileExpiration = z.infer<typeof fileExpirationSchema>;
export type FileStatus = z.infer<typeof fileStatusSchema>;
export type CreateFileInitInput = z.infer<typeof createFileInitSchema>;
export type FilePresignInput = z.infer<typeof filePresignSchema>;
export type FileCompleteInput = z.infer<typeof fileCompleteSchema>;
export type FileMetadata = z.infer<typeof fileMetadataSchema>;

export type PasteMode = z.infer<typeof pasteModeSchema>;
export type TtlSeconds = z.infer<typeof ttlSchema>;
export type CreatePasteInput = z.infer<typeof createPasteSchema>;
export type PasteResponse = z.infer<typeof pasteResponseSchema>;
export type PasteRecord = z.infer<typeof pasteRecordSchema>;
