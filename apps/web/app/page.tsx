"use client";

import clsx from "clsx";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PasteMode, TtlSeconds } from "@solun/shared";
import { MAX_PASTE_BYTES } from "@solun/shared";
import { encrypt, exportKey, generateKey } from "../lib/crypto";
import { getByteLength, validateCreatePayload } from "../lib/validation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const ttlOptions: { label: string; value: TtlSeconds }[] = [
  { label: "After first read", value: "burn" },
  { label: "1 hour", value: 3600 },
  { label: "24 hours", value: 86400 },
  { label: "7 days", value: 604800 },
  { label: "Never", value: null }
];

function ttlToSelectValue(ttl: TtlSeconds): string {
  if (ttl === null) return "never";
  if (ttl === "burn") return "burn";
  return String(ttl);
}

function selectValueToTtl(value: string): TtlSeconds {
  if (value === "never") return null;
  if (value === "burn") return "burn";
  return Number(value) as TtlSeconds;
}

export default function HomePage() {
  const [mode, setMode] = useState<PasteMode>("quick");
  const [content, setContent] = useState("");
  const [ttl, setTtl] = useState<TtlSeconds>("burn");
  const [burnAfterRead, setBurnAfterRead] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; expiresAt: string | null } | null>(null);
  const [copied, setCopied] = useState(false);
  const [linkToast, setLinkToast] = useState(false);

  const bytes = useMemo(() => getByteLength(content), [content]);

  // Auto-dismiss copy toast after 2.5s
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(t);
  }, [copied]);

  // Auto-dismiss link created toast after 3s
  useEffect(() => {
    if (!linkToast) return;
    const t = setTimeout(() => setLinkToast(false), 3000);
    return () => clearTimeout(t);
  }, [linkToast]);

  async function handleCreate() {
    setError(null);
    setResult(null);

    if (!content.trim()) {
      setError("Add some text first.");
      return;
    }

    setLoading(true);
    try {
      let payloadContent = content;
      let iv: string | undefined;
      let keyFragment: string | null = null;

      if (mode === "secure") {
        const key = await generateKey();
        const encrypted = await encrypt(content, key);
        payloadContent = encrypted.ciphertext;
        iv = encrypted.iv;
        keyFragment = await exportKey(key);
      }

      const payload = {
        content: payloadContent,
        mode,
        ttl,
        burnAfterRead: mode === "secure" ? (ttl === "burn" || burnAfterRead) : false,
        iv
      };

      const validation = validateCreatePayload(payload);
      if (!validation.ok) {
        setError(validation.error);
        return;
      }

      const response = await fetch(`${API_URL}/api/paste`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        setError("Failed to create paste.");
        return;
      }

      const data = (await response.json()) as { id: string; expiresAt: string | null };
      const base = window.location.origin;
      const path = mode === "secure" ? `/s/${data.id}` : `/p/${data.id}`;
      const url =
        mode === "secure" && keyFragment ? `${base}${path}#key=${keyFragment}` : `${base}${path}`;

      setResult({ url, expiresAt: data.expiresAt ?? null });
      setLinkToast(true);
    } catch (err) {
      setError("Failed to create paste.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!result?.url) return;
    await navigator.clipboard.writeText(result.url);
    setCopied(true);
  }

  function handleModeChange(newMode: PasteMode) {
    setMode(newMode);
    setBurnAfterRead(false);
    // Clear the link when switching modes, but keep the text
    setResult(null);
    setCopied(false);
  }

  const burnChecked = mode === "quick" ? true : (ttl === "burn" || burnAfterRead);
  const burnDisabled = mode === "quick" || ttl === "burn";
  const burnHint =
    mode === "quick"
      ? "(always on for quick)"
      : ttl === "burn"
        ? "(set by expiration)"
        : null;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      {/* Copy toast */}
      <div
        className={clsx(
          "pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-tide-400/30 bg-ink-800/90 px-5 py-2.5 text-sm text-tide-300 shadow-glow-sm backdrop-blur transition-all duration-300",
          copied ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        )}
      >
        Link copied to clipboard
      </div>

      {/* Link created toast */}
      <div
        className={clsx(
          "pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-tide-400/30 bg-ink-800/90 px-5 py-2.5 text-sm text-tide-300 shadow-glow-sm backdrop-blur transition-all duration-300",
          linkToast && !copied ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        )}
      >
        ✓ Link created
      </div>

      <div className="w-full max-w-3xl space-y-6 rounded-3xl border border-ink-700 bg-ink-800/70 p-8 shadow-glow backdrop-blur">
        <header className="flex items-start gap-4">
          <Image
            src="/logo.svg"
            alt="Solun"
            width={48}
            height={48}
            className="mt-1 shrink-0"
            priority
          />
          <div className="space-y-1.5">
            <h1 className="text-3xl font-semibold tracking-tight text-ink-100">Solun</h1>
            <p className="text-sm text-ink-200">
              Quick mode keeps it fast. Secure mode encrypts in your browser — the server never sees the key.
            </p>
          </div>
        </header>

        <section className="space-y-4">
          <div className="relative inline-flex rounded-full border border-ink-700 bg-ink-700/40 p-1 text-sm">
            {/* Sliding indicator pill */}
            <span
              aria-hidden="true"
              className={clsx(
                "absolute inset-y-1 rounded-full bg-tide-500 transition-all duration-300 ease-in-out",
                mode === "quick" ? "left-1 right-[calc(50%+2px)]" : "left-[calc(50%+2px)] right-1"
              )}
            />
            {(["quick", "secure"] as PasteMode[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleModeChange(option)}
                className={clsx(
                  "relative z-10 w-20 rounded-full py-2 text-center font-medium transition-colors duration-300",
                  mode === option ? "text-ink-900" : "text-ink-200 hover:text-ink-100"
                )}
              >
                {option === "quick" ? "Quick" : "Secure"}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Paste your text here..."
              rows={10}
              className="w-full resize-none rounded-2xl border border-ink-700 bg-ink-900/60 p-4 text-base text-ink-100 outline-none ring-1 ring-transparent focus:border-tide-400 focus:ring-tide-400/30 transition"
            />
            <div className="flex items-center justify-between text-xs text-ink-200">
              <span>{bytes.toLocaleString()} bytes</span>
              <span className={bytes > MAX_PASTE_BYTES ? "text-ember-300" : ""}>
                512 KB max
              </span>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-ink-200">
              <span className="block text-xs uppercase tracking-[0.3em] text-ink-200">
                Expiration
              </span>
              <div className="relative">
                <select
                  value={ttlToSelectValue(ttl)}
                  onChange={(event) => setTtl(selectValueToTtl(event.target.value))}
                  className="w-full appearance-none rounded-xl border border-ink-700 bg-ink-900/60 px-3 py-2 pr-8 text-ink-100 focus:border-tide-400 outline-none transition"
                >
                  {ttlOptions.map((option) => (
                    <option key={String(option.value)} value={ttlToSelectValue(option.value)}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <svg
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-200"
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </label>

            <label className={clsx(
              "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm",
              burnDisabled
                ? "border-ink-700/50 bg-ink-900/40 text-ink-500 cursor-not-allowed"
                : "border-ink-700 bg-ink-900/60 text-ink-200 cursor-pointer"
            )}>
              <input
                type="checkbox"
                checked={burnChecked}
                disabled={burnDisabled}
                onChange={(event) => setBurnAfterRead(event.target.checked)}
                className="h-4 w-4 rounded border-ink-700 bg-ink-900 text-tide-500 disabled:opacity-50 shrink-0"
              />
              <span>
                Burn after first read
                {burnHint ? <span className="ml-1.5 text-xs text-ink-500">{burnHint}</span> : null}
              </span>
            </label>
          </div>

          {error ? (
            <div className="rounded-xl border border-ember-400/40 bg-ember-400/10 px-4 py-2 text-sm text-ember-300">
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleCreate}
              disabled={loading}
              className={clsx(
                "rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-[0.35em] transition",
                loading
                  ? "cursor-wait bg-ink-700 text-ink-500"
                  : "bg-tide-500 text-ink-900 hover:bg-tide-400"
              )}
            >
              {loading ? "Creating..." : "Create"}
            </button>
            <span className="text-xs text-ink-200/60">
              {mode === "secure" ? "End-to-end encrypted" : "Encrypted at rest"}
            </span>
          </div>
        </section>

        {/* Link result — smooth slide-in/out */}
        <div
          className={clsx(
            "overflow-hidden transition-all duration-500 ease-in-out",
            result ? "max-h-48 opacity-100" : "max-h-0 opacity-0"
          )}
        >
          {result && (
            <section className="space-y-3 rounded-2xl border border-ink-700 bg-ink-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.35em] text-ink-200">Your link</p>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <code
                  className="flex-1 break-all text-sm text-tide-300 blur-sm transition-all duration-200 hover:blur-none select-none hover:select-text cursor-pointer"
                  title="Hover to reveal"
                >
                  {result.url}
                </code>
                <button
                  type="button"
                  onClick={handleCopy}
                  className={clsx(
                    "shrink-0 rounded-full border px-4 py-2 text-xs uppercase tracking-[0.3em] transition",
                    copied
                      ? "border-tide-400/60 bg-tide-400/10 text-tide-300"
                      : "border-tide-500/40 text-tide-300 hover:bg-tide-500/10"
                  )}
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              {result.expiresAt ? (
                <p className="text-xs text-ink-200/60">Expires: {new Date(result.expiresAt).toLocaleString()}</p>
              ) : (
                <p className="text-xs text-ink-200/60">Burns after first read</p>
              )}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
