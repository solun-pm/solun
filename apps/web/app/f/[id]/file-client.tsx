"use client";

import clsx from "clsx";
import Link from "next/link";
import { useEffect, useMemo, useReducer } from "react";
import type { FileMetadata } from "@solun/shared";
import { decryptChunk } from "../../../lib/file-crypto";
import { importKey } from "../../../lib/crypto";
import { useDownloadProgress } from "../../../lib/hooks/useDownloadProgress";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type DownloadInfo = {
  id: string;
  mode: "quick" | "secure";
  sizeBytes: number;
  contentType: string;
  originalName: string;
  expiresAt: string;
  maxDownloads: number | null;
  downloadCount: number;
  downloadUrl: string;
  metadataUrl: string;
  fileKey: string | null;
};

type Availability = "checking" | "available" | "missing";
type LoadState = "checking" | "exists" | "loading" | "ready" | "error" | "not-found";
type FileState = {
  error: string | null;
  fileUrl: string | null;
  fileInfo: DownloadInfo | null;
  loading: boolean;
  availability: Availability;
  status: LoadState;
};

type FileAction = {
  type: "patch";
  payload: Partial<FileState>;
};

function reducer(state: FileState, action: FileAction): FileState {
  switch (action.type) {
    case "patch":
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

function createInitialState(initialAvailability?: Availability): FileState {
  const resolvedAvailability = initialAvailability ?? "checking";
  const resolvedStatus: LoadState =
    resolvedAvailability === "available"
      ? "exists"
      : resolvedAvailability === "missing"
        ? "not-found"
        : "checking";
  return {
    error: null,
    fileUrl: null,
    fileInfo: null,
    loading: false,
    availability: resolvedAvailability,
    status: resolvedStatus
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export default function FileDownloadClient({
  id,
  initialAvailability
}: {
  id: string;
  initialAvailability?: Availability;
}) {
  const [state, dispatch] = useReducer(reducer, initialAvailability, createInitialState);

  const {
    progress,
    reset,
    setTotals,
    setError: setProgressError,
    markDownloaded,
    markDecrypted,
    setAssembling,
    setDone
  } = useDownloadProgress();

  const statusText = useMemo(() => {
    if (state.status === "checking") return "Checking...";
    if (state.status === "exists") return "Ready to load.";
    if (state.status === "loading") return "Loading file...";
    if (state.status === "ready") return "Ready.";
    if (state.status === "error") return "Something went wrong.";
    if (state.status === "not-found") return "File not found.";
    return "";
  }, [state.status]);

  async function loadFile() {
    if (state.loading) return;
    reset();
    dispatch({ type: "patch", payload: { loading: true, error: null, status: "loading" } });

    try {
      console.log("[download] start", { id, api: API_URL });
      const response = await fetch(`${API_URL}/api/files/${id}`, { cache: "no-store" });
      if (!response.ok) {
        if (response.status !== 404) {
          console.error("File metadata fetch failed:", response.status, response.statusText);
        }
        dispatch({ type: "patch", payload: { status: "not-found", error: "File not found." } });
        return;
      }

      const info = (await response.json()) as DownloadInfo;
      console.log("[download] info", info);
      dispatch({ type: "patch", payload: { fileInfo: info } });

      const keyFromUrl = new URLSearchParams(window.location.hash.slice(1)).get("key");
      const keyValue = info.mode === "secure" ? keyFromUrl : info.fileKey;
      if (!keyValue) {
        throw new Error("Missing decryption key.");
      }

      const key = await importKey(keyValue);
      console.log("[download] key loaded", { mode: info.mode });

      const metadataResponse = await fetch(info.metadataUrl, { cache: "no-store" });
      if (!metadataResponse.ok) {
        console.error("Metadata fetch failed:", metadataResponse.status, metadataResponse.statusText);
        throw new Error("Failed to load metadata.");
      }

      const metadata = (await metadataResponse.json()) as FileMetadata;
      console.log("[download] metadata", metadata);
      setTotals(metadata.totalSize, metadata.totalChunks);

      const chunks: BlobPart[] = [];
      const authTagBytes = 16;
      for (let index = 0; index < metadata.totalChunks; index += 1) {
        const isLast = index === metadata.totalChunks - 1;
        const plainSize = isLast
          ? metadata.totalSize - (metadata.totalChunks - 1) * metadata.chunkSize
          : metadata.chunkSize;
        const cipherSize = plainSize + authTagBytes;
        const start = index * (metadata.chunkSize + authTagBytes);
        const end = start + cipherSize - 1;

        const chunkResponse = await fetch(info.downloadUrl, {
          headers: {
            Range: `bytes=${start}-${end}`
          }
        });

        if (!chunkResponse.ok) {
          console.error("Chunk fetch failed:", chunkResponse.status, chunkResponse.statusText, {
            start,
            end
          });
          throw new Error("Failed to download chunk.");
        }

        console.log("[download] chunk ok", { index, start, end, size: chunkResponse.headers.get("Content-Length") });
        const encryptedChunk = await chunkResponse.arrayBuffer();
        markDownloaded(index + 1, encryptedChunk.byteLength);

        const decrypted = await decryptChunk(encryptedChunk, metadata.ivs[index], key);
        markDecrypted(index + 1);

        chunks.push(decrypted as ArrayBuffer);
      }

      setAssembling();
      const blob = new Blob(chunks, { type: info.contentType });
      const url = URL.createObjectURL(blob);
      dispatch({ type: "patch", payload: { fileUrl: url, status: "ready" } });
      setDone();
      setTimeout(() => {
        const link = document.createElement("a");
        link.href = url;
        link.download = info.originalName;
        link.click();
      }, 0);
      await fetch(`${API_URL}/api/files/${id}/downloaded`, { method: "POST" }).catch(() => undefined);
      console.log("[download] done", { id });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load file.";
      setProgressError(message);
      console.error("[download] error", message);
      dispatch({
        type: "patch",
        payload: { error: message, status: message === "File not found." ? "not-found" : "error" }
      });
    } finally {
      dispatch({ type: "patch", payload: { loading: false } });
    }
  }

  useEffect(() => {
    return () => {
      if (state.fileUrl) {
        URL.revokeObjectURL(state.fileUrl);
      }
    };
  }, [state.fileUrl]);

  async function handleDownload() {
    if (!state.fileUrl || !state.fileInfo?.originalName) return;
    const link = document.createElement("a");
    link.href = state.fileUrl;
    link.download = state.fileInfo.originalName;
    link.click();

    await fetch(`${API_URL}/api/files/${id}/downloaded`, { method: "POST" });
  }


  return (
    <main className="flex min-h-screen items-start justify-center px-4 pt-10 pb-6">
      <div className="w-full max-w-2xl space-y-6 rounded-3xl border border-ink-700 bg-ink-800/70 p-8 shadow-glow backdrop-blur">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.4em] text-tide-300/70">Solun · File</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink-100">
            {state.status === "not-found"
              ? "File not found"
              : state.status === "error"
                ? "Something went wrong"
                : "You received a file"}
          </h1>
          {(state.status === "exists" || state.status === "ready") && state.fileInfo ? (
            <p className="text-sm text-ink-200">
              {state.fileInfo.originalName} · {formatBytes(state.fileInfo.sizeBytes)} · {state.fileInfo.mode === "secure" ? "Secure" : "Quick"}
            </p>
          ) : null}
        </header>

        {state.status === "not-found" ? (
          <p className="text-sm text-ink-200">This file does not exist or has expired.</p>
        ) : null}

        {state.error ? (
          <div className="rounded-xl border border-ember-400/40 bg-ember-400/10 px-4 py-2 text-sm text-ember-300">
            {state.error}
          </div>
        ) : null}

        {state.status !== "not-found" ? (
          <section className="space-y-3 rounded-2xl border border-ink-700 bg-ink-900/60 p-4">
            <div className="flex items-center justify-between text-xs text-ink-200">
              <span className="uppercase tracking-[0.3em]">{statusText}</span>
              <span>{progress.overallPercent.toFixed(0)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-ink-700">
              <div
                className={clsx("h-full bg-tide-500 transition-all", progress.status === "error" && "bg-ember-400")}
                style={{ width: `${progress.overallPercent}%` }}
              />
            </div>
            <div className="grid gap-2 text-xs text-ink-200 md:grid-cols-3">
              <span>Speed: {formatBytes(progress.speedBytesPerSec)}/s</span>
              <span>ETA: {progress.estimatedSecondsLeft ? `~${Math.ceil(progress.estimatedSecondsLeft)}s` : "-"}</span>
              <span>
                {progress.downloadedChunks}/{progress.totalChunks} chunks
              </span>
            </div>
          </section>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          {state.status === "not-found" ? (
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-tide-400 to-tide-600 px-5 py-2.5 text-sm font-medium text-white shadow-glow-sm transition hover:opacity-90"
            >
              <span>+</span>
              Create new file
            </Link>
          ) : !state.fileUrl ? (
            <button
              type="button"
              onClick={loadFile}
              disabled={state.loading || state.availability !== "available"}
              className={clsx(
                "rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-[0.35em] transition",
                state.loading || state.availability !== "available"
                  ? "cursor-wait bg-ink-700 text-ink-500"
                  : "bg-tide-500 text-ink-900 hover:bg-tide-400"
              )}
            >
              {state.loading
                ? "Loading..."
                : state.availability === "checking"
                  ? "Checking..."
                  : "Load file"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleDownload}
              className="rounded-full bg-tide-500 px-6 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-ink-900 hover:bg-tide-400 transition"
            >
              Download
            </button>
          )}
          {state.fileInfo?.expiresAt ? (
            <span className="text-xs text-ink-200/60">
              Expires: {new Date(state.fileInfo.expiresAt).toLocaleString()}
            </span>
          ) : null}
        </div>
      </div>
    </main>
  );
}
