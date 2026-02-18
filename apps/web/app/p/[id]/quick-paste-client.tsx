"use client";

import { useState } from "react";
import Link from "next/link";
import type { PasteRecord } from "@solun/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type LoadState = "idle" | "loading" | "ready" | "error" | "not-found";

export default function QuickPasteClient({ id }: { id: string }) {
  const [state, setState] = useState<LoadState>("idle");
  const [data, setData] = useState<PasteRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleReveal() {
    setState("loading");
    try {
      const response = await fetch(`${API_URL}/api/paste/${id}`, { cache: "no-store" });

      if (response.status === 404) {
        setState("not-found");
        return;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        setError(body.error ?? "This message could not be loaded.");
        setState("error");
        return;
      }

      const json = (await response.json()) as PasteRecord;
      setData(json);
      setState("ready");
    } catch {
      setError("Failed to load message. Please check your connection.");
      setState("error");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl space-y-6 rounded-3xl border border-ink-700 bg-ink-800/70 p-8 shadow-glow backdrop-blur">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.4em] text-tide-300/70">Solun · Quick</p>
          <h1 className="text-3xl font-semibold text-ink-100">
            {state === "ready"
              ? "You received a message"
              : state === "not-found"
                ? "Message not found"
                : state === "error"
                  ? "Something went wrong"
                  : "You received a message"}
          </h1>
          {state === "idle" && (
            <p className="text-ink-200">This message will be gone after you read it.</p>
          )}
          {state === "ready" && (
            <p className="text-ink-200">Encrypted at rest, decrypted on delivery.</p>
          )}
        </header>

        {state === "idle" && (
          <div className="flex flex-col items-start gap-4">
            <button
              type="button"
              onClick={handleReveal}
              className="rounded-full bg-tide-500 px-6 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-ink-900 transition hover:bg-tide-400"
            >
              Reveal message
            </button>
          </div>
        )}

        {state === "loading" && (
          <p className="text-sm text-ink-200">Loading message...</p>
        )}

        {state === "not-found" && (
          <p className="text-sm text-ink-200">
            This message does not exist or has already been read and deleted.
          </p>
        )}

        {state === "error" && error && (
          <div className="rounded-xl border border-ember-400/40 bg-ember-400/10 px-4 py-3 text-sm text-ember-300">
            {error}
          </div>
        )}

        {state === "ready" && data && (
          <>
            <textarea
              readOnly
              value={data.content}
              rows={12}
              className="w-full resize-none rounded-2xl border border-ink-700 bg-ink-900/60 p-4 text-base text-ink-100"
            />
            <p className="text-xs text-ink-400">This message has now been deleted.</p>
          </>
        )}

        {(state === "ready" || state === "not-found" || state === "error") && (
          <div className="border-t border-ink-700 pt-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-tide-400 to-tide-600 px-5 py-2.5 text-sm font-medium text-white shadow-glow-sm transition hover:opacity-90"
            >
              <span>+</span>
              Create new message
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
