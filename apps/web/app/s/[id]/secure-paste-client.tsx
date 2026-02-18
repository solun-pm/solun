"use client";

import { useEffect, useRef, useState } from "react";
import type { PasteRecord } from "@solun/shared";
import { decrypt, importKey } from "../../../lib/crypto";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type LoadState = "idle" | "loading" | "ready" | "error";

export default function SecurePasteClient({ id }: { id: string }) {
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [ciphertext, setCiphertext] = useState<string | null>(null);
  const [iv, setIv] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [burnAfterRead, setBurnAfterRead] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  // Use a ref so handleReveal always has the current key without re-render races
  const keyRef = useRef<string | null>(null);

  useEffect(() => {
    const fragment = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(fragment);
    const key = params.get("key");

    if (!key) {
      setError("Missing decryption key in URL.");
      setState("error");
      return;
    }

    keyRef.current = key;

    async function load(keyValue: string) {
      setState("loading");
      try {
        const response = await fetch(`${API_URL}/api/paste/${id}`, { cache: "no-store" });
        if (!response.ok) {
          setError("Secret not found or expired.");
          setState("error");
          return;
        }

        const data = (await response.json()) as PasteRecord;
        if (data.mode !== "secure") {
          setError("This link is not a secure paste.");
          setState("error");
          return;
        }

        if (data.iv === null) {
          setError("Missing IV for this secret.");
          setState("error");
          return;
        }

        setCiphertext(data.content);
        setIv(data.iv);
        setBurnAfterRead(data.burnAfterRead);
        setExpiresAt(data.expiresAt ?? null);

        if (data.burnAfterRead) {
          setAwaitingConfirm(true);
          setState("ready");
          return;
        }

        await reveal(data.content, data.iv, keyValue);
      } catch (err) {
        setError("Failed to load secret.");
        setState("error");
      }
    }

    void load(key);
  }, [id]);

  async function reveal(payload: string, ivValue: string, keyValue: string) {
    try {
      const cryptoKey = await importKey(keyValue);
      const decrypted = await decrypt(payload, ivValue, cryptoKey);
      setContent(decrypted);
      setAwaitingConfirm(false);
      setState("ready");
    } catch (err) {
      setError("Failed to decrypt. Check the link fragment.");
      setState("error");
    }
  }

  async function handleReveal() {
    const keyValue = keyRef.current;
    const currentCiphertext = ciphertext;
    const currentIv = iv;
    if (!currentCiphertext || !currentIv || !keyValue) return;
    await reveal(currentCiphertext, currentIv, keyValue);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl space-y-6 rounded-3xl border border-ink-700 bg-ink-800/70 p-8 shadow-glow backdrop-blur">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.4em] text-tide-300/70">Solun · Secure</p>
          <h1 className="text-3xl font-semibold text-ink-100">Secret {id}</h1>
          <p className="text-ink-200">Decrypts locally in your browser. The server never sees the key.</p>
        </header>

        {state === "loading" ? (
          <p className="text-sm text-ink-200">Loading and decrypting...</p>
        ) : null}

        {state === "error" && error ? (
          <div className="rounded-xl border border-ember-400/40 bg-ember-400/10 px-4 py-2 text-sm text-ember-300">
            {error}
          </div>
        ) : null}

        {awaitingConfirm ? (
          <div className="space-y-4 rounded-2xl border border-ember-400/40 bg-ember-400/10 p-4 text-ember-300">
            <p className="text-sm">
              This secret is set to burn after reading. Reveal it only when you are ready.
            </p>
            <button
              type="button"
              onClick={handleReveal}
              className="rounded-full border border-ember-400/60 px-4 py-2 text-xs uppercase tracking-[0.3em] text-ember-300 hover:bg-ember-400/10"
            >
              Reveal Secret
            </button>
          </div>
        ) : null}

        {content ? (
          <textarea
            readOnly
            value={content}
            rows={12}
            className="w-full resize-none rounded-2xl border border-ink-700 bg-ink-900/60 p-4 text-base text-ink-100"
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-3 text-xs text-ink-400">
          <span>Mode: secure</span>
          {burnAfterRead ? <span>Burns after read</span> : <span>Persistent</span>}
          {expiresAt ? (
            <span>Expires: {new Date(expiresAt).toLocaleString()}</span>
          ) : (
            <span>No expiration</span>
          )}
        </div>
      </div>
    </main>
  );
}
