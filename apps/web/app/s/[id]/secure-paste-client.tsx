"use client";

import { useEffect, useReducer } from "react";
import Link from "next/link";
import useSWR from "swr";
import type { PasteRecord } from "@solun/shared";
import { decrypt, importKey } from "../../../lib/crypto";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type LoadState = "idle" | "loading" | "ready" | "error";

type SecureState = {
  status: LoadState;
  error: string | null;
  ciphertext: string | null;
  iv: string | null;
  content: string | null;
  burnAfterRead: boolean;
  expiresAt: string | null;
  awaitingConfirm: boolean;
  key: string | null;
};

type SecureAction = {
  type: "patch";
  payload: Partial<SecureState>;
};

const initialState: SecureState = {
  status: "idle",
  error: null,
  ciphertext: null,
  iv: null,
  content: null,
  burnAfterRead: false,
  expiresAt: null,
  awaitingConfirm: false,
  key: null
};

function reducer(state: SecureState, action: SecureAction): SecureState {
  switch (action.type) {
    case "patch":
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

export default function SecurePasteClient({ id }: { id: string }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const fragment = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(fragment);
    const keyValue = params.get("key");

    if (!keyValue) {
      dispatch({
        type: "patch",
        payload: { error: "Missing decryption key in URL.", status: "error" }
      });
      return;
    }

    dispatch({ type: "patch", payload: { key: keyValue, error: null } });
  }, []);

  const { data, error: fetchError, isLoading } = useSWR<PasteRecord>(
    state.key ? `${API_URL}/api/paste/${id}` : null,
    async (url: string) => {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Secret not found or expired.");
      }
      return response.json() as Promise<PasteRecord>;
    },
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    if (!state.key) return;
    if (isLoading) {
      dispatch({ type: "patch", payload: { status: "loading", error: null } });
      return;
    }
    if (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Failed to load secret.";
      dispatch({ type: "patch", payload: { error: message, status: "error" } });
      return;
    }
    if (!data) return;
    if (data.mode !== "secure") {
      dispatch({
        type: "patch",
        payload: { error: "This link is not a secure paste.", status: "error" }
      });
      return;
    }
    if (data.iv === null) {
      dispatch({
        type: "patch",
        payload: { error: "Missing IV for this secret.", status: "error" }
      });
      return;
    }

    const awaitingConfirm = data.burnAfterRead;
    dispatch({
      type: "patch",
      payload: {
        ciphertext: data.content,
        iv: data.iv,
        burnAfterRead: data.burnAfterRead,
        expiresAt: data.expiresAt ?? null,
        awaitingConfirm,
        status: awaitingConfirm ? "ready" : "loading",
        error: null
      }
    });

    if (!awaitingConfirm && !state.content) {
      void reveal(data.content, data.iv, state.key);
    }
  }, [data, fetchError, isLoading, state.content, state.key]);

  async function reveal(payload: string, ivValue: string, keyValue: string) {
    try {
      const cryptoKey = await importKey(keyValue);
      const decrypted = await decrypt(payload, ivValue, cryptoKey);
      dispatch({
        type: "patch",
        payload: { content: decrypted, awaitingConfirm: false, status: "ready", error: null }
      });
    } catch (err) {
      dispatch({
        type: "patch",
        payload: { error: "Failed to decrypt. Check the link fragment.", status: "error" }
      });
    }
  }

  async function handleReveal() {
    const keyValue = state.key;
    const currentCiphertext = state.ciphertext;
    const currentIv = state.iv;
    if (!currentCiphertext || !currentIv || !keyValue) return;
    await reveal(currentCiphertext, currentIv, keyValue);
  }

  return (
    <main className="flex min-h-screen items-start justify-center px-4 pt-10 pb-6">
      <div className="w-full max-w-3xl space-y-6 rounded-3xl border border-ink-700 bg-ink-800/70 p-8 shadow-glow backdrop-blur">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.4em] text-tide-300/70">Solun · Secure</p>
          <h1 className="text-3xl font-semibold text-ink-100">You received a secret</h1>
          <p className="text-ink-200">Decrypts locally in your browser. The server never sees the key.</p>
        </header>

        {state.status === "loading" ? (
          <p className="text-sm text-ink-200">Decrypting...</p>
        ) : null}

        {state.status === "error" && state.error ? (
          <div className="rounded-xl border border-ember-400/40 bg-ember-400/10 px-4 py-2 text-sm text-ember-300">
            {state.error}
          </div>
        ) : null}

        {state.awaitingConfirm ? (
          <div className="flex flex-col items-start gap-4">
            <p className="text-sm text-ink-200">This message will be gone after you read it.</p>
            <button
              type="button"
              onClick={handleReveal}
              className="rounded-full bg-tide-500 px-6 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-ink-900 transition hover:bg-tide-400"
            >
              Decrypt
            </button>
          </div>
        ) : null}

        {state.content ? (
          <textarea
            readOnly
            value={state.content}
            rows={12}
            className="w-full resize-none rounded-2xl border border-ink-700 bg-ink-900/60 p-4 text-base text-ink-100"
          />
        ) : null}

        {state.content && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-ink-400">
            {state.burnAfterRead ? <span>This message has now been deleted.</span> : null}
            {state.expiresAt ? (
              <span>Expires: {new Date(state.expiresAt).toLocaleString()}</span>
            ) : null}
          </div>
        )}

        {(state.content || state.status === "error") && (
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
