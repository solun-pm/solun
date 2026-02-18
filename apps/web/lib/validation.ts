import { createPasteSchema, MAX_PASTE_BYTES } from "@solun/shared";

export function getByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function validateCreatePayload(payload: unknown): { ok: true } | { ok: false; error: string } {
  const parsed = createPasteSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: "Fill in all required fields." };
  }
  if (getByteLength(parsed.data.content) > MAX_PASTE_BYTES) {
    return { ok: false, error: "Paste exceeds 512KB limit." };
  }
  return { ok: true };
}
