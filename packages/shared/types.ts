import { z } from "zod";

export const MAX_PASTE_BYTES = 512 * 1024;

export const pasteModeSchema = z.enum(["quick", "secure"]);

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

export type PasteMode = z.infer<typeof pasteModeSchema>;
export type TtlSeconds = z.infer<typeof ttlSchema>;
export type CreatePasteInput = z.infer<typeof createPasteSchema>;
export type PasteResponse = z.infer<typeof pasteResponseSchema>;
export type PasteRecord = z.infer<typeof pasteRecordSchema>;
