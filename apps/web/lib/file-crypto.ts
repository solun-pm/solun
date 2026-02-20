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

export async function encryptChunk(buffer: ArrayBuffer, key: CryptoKey): Promise<{
  ciphertext: Uint8Array;
  iv: string;
}> {
  const ivBytes = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: ivBytes }, key, buffer);
  return {
    ciphertext: new Uint8Array(ciphertext),
    iv: toBase64(ivBytes)
  };
}

export async function decryptChunk(
  ciphertext: ArrayBuffer,
  ivB64: string,
  key: CryptoKey
): Promise<ArrayBuffer> {
  const ivBytes = fromBase64(ivB64);
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: ivBytes as BufferSource }, key, ciphertext);
}
