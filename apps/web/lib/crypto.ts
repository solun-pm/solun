function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const buffer = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  buffer.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toBase64Url(value: string): string {
  return value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): string {
  const padded = value.padEnd(Math.ceil(value.length / 4) * 4, "=");
  return padded.replace(/-/g, "+").replace(/_/g, "/");
}

export async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function encrypt(
  plaintext: string,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return {
    ciphertext: toBase64(ciphertext),
    iv: toBase64(iv)
  };
}

export async function decrypt(ciphertext: string, iv: string, key: CryptoKey): Promise<string> {
  const bytes = fromBase64(ciphertext);
  const ivBytes = fromBase64(iv);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes as BufferSource },
    key,
    bytes as BufferSource
  );
  return new TextDecoder().decode(plaintext);
}

export async function exportKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return toBase64Url(toBase64(raw));
}

export async function importKey(keyStr: string): Promise<CryptoKey> {
  const base64 = fromBase64Url(keyStr);
  const raw = fromBase64(base64);
  return crypto.subtle.importKey("raw", raw as BufferSource, "AES-GCM", true, [
    "encrypt",
    "decrypt"
  ]);
}
