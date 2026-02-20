"use client";

import clsx from "clsx";
import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import type { FileExpiration, FileMetadata, FileMode, PasteMode } from "@solun/shared";
import { FILE_CHUNK_SIZE, MAX_FILE_BYTES, MAX_PASTE_BYTES } from "@solun/shared";
import { encrypt, exportKey, generateKey, importKey } from "../lib/crypto";
import { getByteLength, validateCreatePayload } from "../lib/validation";
import { encryptChunk } from "../lib/file-crypto";
import { useUploadProgress } from "../lib/hooks/useUploadProgress";
import ShareSwitch, { type ShareKind } from "./components/share-switch";

const API_URL = process.env.NEXT_PUBLIC_API_URL -- "http://localhost:3001";

const fileExpirationOptions: { label: string; value: FileExpiration }[] = [
  { label: "1 hour", value: "1h" },
  { label: "24 hours", value: "24h" },
  { label: "7 days", value: "7d" }
];

type ResumeState = {
  id: string;
  uploadId: string;
  r2Key: string;
  metadataKey: string;
  partSize: number;
  totalChunks: number;
  fileFingerprint: string;
  parts: { partNumber: number; etag: string }[];
  ivs: string[];
  expiresAt: string;
  key: string;
};

type PasteResult = { url: string; expiresAt: string | null } | null;

type PasteState = {
  mode: PasteMode;
  content: string;
  loading: boolean;
  error: string | null;
  result: PasteResult;
  copied: boolean;
  linkToast: boolean;
};

type FileResult = { url: string; expiresAt: string } | null;

type FileState = {
  mode: FileMode;
  expiresIn: FileExpiration;
  file: File | null;
  error: string | null;
  result: FileResult;
  resumeState: ResumeState | null;
  copied: boolean;
  linkToast: boolean;
};

type PatchAction<T> = {
  type: "patch";
  payload: Partial<T>;
};

function patchReducer<T>(state: T, action: PatchAction<T>): T {
  switch (action.type) {
    case "patch":
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

const initialPasteState: PasteState = {
  mode: "quick",
  content: "",
  loading: false,
  error: null,
  result: null,
  copied: false,
  linkToast: false
};

const initialFileState: FileState = {
  mode: "quick",
  expiresIn: "24h",
  file: null,
  error: null,
  result: null,
  resumeState: null,
  copied: false,
  linkToast: false
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return "-";
  return `${formatBytes(bytesPerSec)}/s`;
}

function formatEta(seconds: number): string {
  if (!seconds || seconds <= 0) return "-";
  if (seconds < 60) return `~${Math.ceil(seconds)}s`;
  const mins = Math.ceil(seconds / 60);
  return `~${mins}m`;
}

function fingerprintFile(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function loadResumeState(file: File): ResumeState | null {
  const key = `solun:upload:${fingerprintFile(file)}`;
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ResumeState;
    if (parsed.fileFingerprint !== fingerprintFile(file)) return null;
    if (!parsed.key) return null;
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      sessionStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
}

function saveResumeState(file: File, state: ResumeState) {
  sessionStorage.setItem(`solun:upload:${fingerprintFile(file)}`, JSON.stringify(state));
}

function clearResumeState(file: File) {
  sessionStorage.removeItem(`solun:upload:${fingerprintFile(file)}`);
}

function DropZone({ file, onFile }: { file: File | null; onFile: (f: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files[0];
    if (dropped) onFile(dropped);
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.files-.[0];
    if (next) onFile(next);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="File drop zone"
      onClick={() => inputRef.current-.click()}
      onKeyDown={(e) => e.key === "Enter" && inputRef.current-.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={clsx(
        "flex h-36 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed transition-all duration-200",
        dragging
          - "border-tide-400 bg-tide-400/5 scale-[1.01]"
          : file
            - "border-tide-500/40 bg-ink-900/40"
            : "border-ink-700 bg-ink-900/40 hover:border-ink-600 hover:bg-ink-900/60"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleChange}
      />
      {file - (
        <>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-tide-400"
            aria-hidden="true"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <span className="max-w-[90%] truncate text-sm font-medium text-ink-100">{file.name}</span>
          <span className={clsx("text-xs", file.size > MAX_FILE_BYTES - "text-ember-300" : "text-ink-400")}>
            {formatBytes(file.size)}{file.size > MAX_FILE_BYTES - " - exceeds 500 MB limit" : ""}
          </span>
        </>
      ) : (
        <>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-ink-500"
            aria-hidden="true"
          >
            <polyline points="16 16 12 12 8 16"/>
            <line x1="12" y1="12" x2="12" y2="21"/>
            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
          </svg>
          <span className="text-sm text-ink-400">Drop a file here or <span className="text-tide-300">browse</span></span>
          <span className="text-xs text-ink-600">up to 500 MB</span>
        </>
      )}
    </div>
  );
}



export default function HomePage() {
  const [shareKind, setShareKind] = useState<ShareKind>("text");

  const [pasteState, dispatchPaste] = useReducer(patchReducer<PasteState>, initialPasteState);
  const [fileState, dispatchFile] = useReducer(patchReducer<FileState>, initialFileState);

  const { mode, content, loading, error, result, copied, linkToast } = pasteState;
  const {
    mode: fileMode,
    expiresIn: fileExpiresIn,
    file,
    error: fileError,
    result: fileResult,
    resumeState,
    copied: fileCopied,
    linkToast: fileLinkToast
  } = fileState;

  const setMode = (next: PasteMode) => dispatchPaste({ type: "patch", payload: { mode: next } });
  const setContent = (next: string) => dispatchPaste({ type: "patch", payload: { content: next } });
  const setLoading = (next: boolean) => dispatchPaste({ type: "patch", payload: { loading: next } });
  const setError = (next: string | null) => dispatchPaste({ type: "patch", payload: { error: next } });
  const setResult = (next: PasteResult) => dispatchPaste({ type: "patch", payload: { result: next } });
  const setCopied = (next: boolean) => dispatchPaste({ type: "patch", payload: { copied: next } });
  const setLinkToast = (next: boolean) => dispatchPaste({ type: "patch", payload: { linkToast: next } });

  const setFileMode = (next: FileMode) => dispatchFile({ type: "patch", payload: { mode: next } });
  const setFileExpiresIn = (next: FileExpiration) =>
    dispatchFile({ type: "patch", payload: { expiresIn: next } });
  const setFile = (next: File | null) => dispatchFile({ type: "patch", payload: { file: next } });
  const setFileError = (next: string | null) => dispatchFile({ type: "patch", payload: { error: next } });
  const setFileResult = (next: FileResult) => dispatchFile({ type: "patch", payload: { result: next } });
  const setResumeState = (next: ResumeState | null) =>
    dispatchFile({ type: "patch", payload: { resumeState: next } });
  const setFileCopied = (next: boolean) => dispatchFile({ type: "patch", payload: { copied: next } });
  const setFileLinkToast = (next: boolean) =>
    dispatchFile({ type: "patch", payload: { linkToast: next } });

  const bytes = useMemo(() => getByteLength(content), [content]);
  const fileChunks = useMemo(() => (file - Math.ceil(file.size / FILE_CHUNK_SIZE) : 0), [file]);
  const textPanelRef = useRef<HTMLDivElement | null>(null);
  const filesPanelRef = useRef<HTMLDivElement | null>(null);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Solun",
      url: "https://solun.pm",
      description:
        "Privacy-first paste and file sharing with end-to-end encryption, burn-after-read, and strict expirations.",
      publisher: {
        "@type": "Organization",
        name: "Solun",
        url: "https://solun.pm"
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Solun",
      url: "https://solun.pm",
      logo: "https://solun.pm/logo.svg",
      sameAs: ["https://github.com/solun-pm/solun"]
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Solun",
      applicationCategory: "SecurityApplication",
      operatingSystem: "Web",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD"
      },
      description:
        "Privacy-first paste and file sharing with end-to-end encryption, burn-after-read, and strict expirations. Share sensitive text and files securely with automatic deletion and client-side encryption.",
      url: "https://solun.pm",
      screenshot: "https://solun.pm/logo.svg",
      softwareVersion: "1.0",
      publisher: {
        "@type": "Organization",
        name: "Solun",
        logo: {
          "@type": "ImageObject",
          url: "https://solun.pm/logo.svg"
        }
      },
      featureList: [
        "End-to-end encryption",
        "Burn-after-read",
        "Automatic expiration",
        "Secure file sharing up to 500MB",
        "No tracking or analytics",
        "Open source"
      ]
    }
  ];

  const {
    progress,
    reset: resetUploadProgress,
    setTotals,
    setStatus,
    setError: setUploadError,
    markEncrypted,
    setEncryptedChunks,
    markUploaded,
    setUploadedBytes,
    setFinalizing,
    setDone
  } = useUploadProgress();
  const uploadActions: UploadActions = {
    setTotals,
    setStatus,
    setError: setUploadError,
    markEncrypted,
    setEncryptedChunks,
    markUploaded,
    setUploadedBytes,
    setFinalizing,
    setDone
  };

  const isUploadBusy =
    progress.status === "encrypting" || progress.status === "uploading" || progress.status === "finalizing";

  const panelHeight = useSharePanelHeight({
    shareKind,
    textPanelRef,
    filesPanelRef,
    deps: [content, bytes, file, fileChunks, result, fileResult, error, fileError, progress.status]
  });

  useResumeTracker({ file, shareKind, fileMode, setResumeState });
  useAutoReset(copied, () => setCopied(false), 2500);
  useAutoReset(fileCopied, () => setFileCopied(false), 2500);
  useAutoReset(fileLinkToast, () => setFileLinkToast(false), 3000);
  useAutoReset(linkToast, () => setLinkToast(false), 3000);

  async function handleCreate() {
    await createPaste({
      mode,
      content,
      setError,
      setResult,
      setLinkToast,
      setLoading
    });
  }

  async function handleCopy() {
    if (!result-.url) return;
    await navigator.clipboard.writeText(result.url);
    setCopied(true);
  }

  function handleModeChange(newMode: PasteMode) {
    setMode(newMode);
    setResult(null);
    setCopied(false);
  }

  async function handleQuickUpload(selected: File) {
    return quickUpload({
      selected,
      fileChunks,
      fileExpiresIn,
      setFileError,
      setFileResult,
      setFileLinkToast,
      upload: uploadActions
    });
  }

  async function handleSecureUpload(selected: File, resume: ResumeState | null) {
    return secureUpload({
      selected,
      fileChunks,
      fileExpiresIn,
      resume,
      setFileError,
      setFileResult,
      setFileLinkToast,
      upload: uploadActions
    });
  }

  async function handleFileUpload(useResume: boolean) {
    if (!file) {
      setFileError("Choose a file first.");
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      setFileError("File exceeds 500MB limit.");
      return;
    }

    resetUploadProgress();

    try {
      if (fileMode === "quick") {
        await handleQuickUpload(file);
      } else {
        await handleSecureUpload(file, useResume - resumeState : null);
      }
    } catch (err) {
      const message = err instanceof Error - err.message : "Upload failed.";
      setFileError(message);
      setUploadError(message);
    }
  }

  return (
    <HomeLayout
      shareKind={shareKind}
      onShareKindChange={setShareKind}
      panelHeight={panelHeight}
      textPanelRef={textPanelRef}
      filesPanelRef={filesPanelRef}
      paste={{
        mode,
        content,
        bytes,
        error,
        loading,
        result,
        copied,
        onModeChange: handleModeChange,
        onContentChange: setContent,
        onCreate: handleCreate,
        onCopy: handleCopy
      }}
      file={{
        fileMode,
        file,
        fileExpiresIn,
        resumeState,
        fileError,
        isUploadBusy,
        progress,
        fileResult,
        fileCopied,
        onFileModeChange: (nextMode) => {
          setFileMode(nextMode);
          setFileError(null);
          setFileResult(null);
        },
        onFileSelect: (next) => {
          setFile(next);
          setFileError(null);
          setFileResult(null);
          resetUploadProgress();
        },
        onFileExpiresInChange: setFileExpiresIn,
        onUpload: handleFileUpload,
        onFileCopy: async (url) => {
          await navigator.clipboard.writeText(url);
          setFileCopied(true);
        }
      }}
      toasts={{
        copied,
        linkToast,
        fileCopied,
        fileLinkToast
      }}
      jsonLd={jsonLd}
    />
  );
}

type HomeLayoutProps = {
  shareKind: ShareKind;
  onShareKindChange: (kind: ShareKind) => void;
  panelHeight: number | null;
  textPanelRef: React.RefObject<HTMLDivElement>;
  filesPanelRef: React.RefObject<HTMLDivElement>;
  paste: {
    mode: PasteMode;
    content: string;
    bytes: number;
    error: string | null;
    loading: boolean;
    result: PasteResult;
    copied: boolean;
    onModeChange: (mode: PasteMode) => void;
    onContentChange: (value: string) => void;
    onCreate: () => void;
    onCopy: () => void;
  };
  file: {
    fileMode: FileMode;
    file: File | null;
    fileExpiresIn: FileExpiration;
    resumeState: ResumeState | null;
    fileError: string | null;
    isUploadBusy: boolean;
    progress: ReturnType<typeof useUploadProgress>["progress"];
    fileResult: FileResult;
    fileCopied: boolean;
    onFileModeChange: (mode: FileMode) => void;
    onFileSelect: (file: File) => void;
    onFileExpiresInChange: (value: FileExpiration) => void;
    onUpload: (useResume: boolean) => void;
    onFileCopy: (url: string) => void;
  };
  toasts: {
    copied: boolean;
    linkToast: boolean;
    fileCopied: boolean;
    fileLinkToast: boolean;
  };
  jsonLd: unknown;
};

function HomeLayout({
  shareKind,
  onShareKindChange,
  panelHeight,
  textPanelRef,
  filesPanelRef,
  paste,
  file,
  toasts,
  jsonLd
}: HomeLayoutProps) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div
        className={clsx(
          "pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-tide-400/30 bg-ink-800/90 px-5 py-2.5 text-sm text-tide-300 shadow-glow-sm backdrop-blur transition-all duration-300",
          toasts.fileCopied - "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        )}
      >
        Link copied to clipboard
      </div>

      <div
        className={clsx(
          "pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-tide-400/30 bg-ink-800/90 px-5 py-2.5 text-sm text-tide-300 shadow-glow-sm backdrop-blur transition-all duration-300",
          toasts.fileLinkToast && !toasts.fileCopied - "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        )}
      >
        Link created
      </div>

      <div
        className={clsx(
          "pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-tide-400/30 bg-ink-800/90 px-5 py-2.5 text-sm text-tide-300 shadow-glow-sm backdrop-blur transition-all duration-300",
          toasts.copied - "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        )}
      >
        Link copied to clipboard
      </div>

      <div
        className={clsx(
          "pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-tide-400/30 bg-ink-800/90 px-5 py-2.5 text-sm text-tide-300 shadow-glow-sm backdrop-blur transition-all duration-300",
          toasts.linkToast && !toasts.copied - "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        )}
      >
        Link created
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
              Quick mode keeps it fast. Secure mode encrypts in your browser - the server never sees the key.
            </p>
          </div>
        </header>
        <ShareSwitch value={shareKind} onChange={onShareKindChange} />

        <div
          className="relative transition-[height] duration-700 ease-[cubic-bezier(0.16,0.84,0.44,1)] will-change-[height]"
          style={panelHeight - { height: `${panelHeight}px` } : undefined}
        >
          <section
            ref={textPanelRef}
            className={clsx(
              "absolute inset-x-0 top-0 space-y-4 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.16,0.84,0.44,1)]",
              shareKind === "text"
                - "opacity-100 translate-y-0 pointer-events-auto"
                : "opacity-0 translate-y-1 pointer-events-none"
            )}
          >
            <TextSharePanel
              mode={paste.mode}
              onModeChange={paste.onModeChange}
              content={paste.content}
              onContentChange={paste.onContentChange}
              bytes={paste.bytes}
              error={paste.error}
              loading={paste.loading}
              onCreate={paste.onCreate}
              result={paste.result}
              copied={paste.copied}
              onCopy={paste.onCopy}
            />
          </section>

          <section
            ref={filesPanelRef}
            className={clsx(
              "absolute inset-x-0 top-0 space-y-4 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.16,0.84,0.44,1)]",
              shareKind === "files"
                - "opacity-100 translate-y-0 pointer-events-auto"
                : "opacity-0 translate-y-1 pointer-events-none"
            )}
          >
            <FileSharePanel
              fileMode={file.fileMode}
              onFileModeChange={file.onFileModeChange}
              file={file.file}
              onFileSelect={file.onFileSelect}
              fileExpiresIn={file.fileExpiresIn}
              onFileExpiresInChange={file.onFileExpiresInChange}
              resumeState={file.resumeState}
              fileError={file.fileError}
              isUploadBusy={file.isUploadBusy}
              onUpload={file.onUpload}
              progress={file.progress}
              fileResult={file.fileResult}
              fileCopied={file.fileCopied}
              onFileCopy={file.onFileCopy}
            />
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-700 pt-6 text-xs text-ink-200/70">
          <span>Made with love by the Solun team</span>
          <div className="flex items-center gap-4">
            <Link href="/learn" className="text-tide-300 hover:text-tide-200 transition">
              Learn
            </Link>
            <Link href="/roadmap" className="text-tide-300 hover:text-tide-200 transition">
              Roadmap
            </Link>
            <a
              href="https://github.com/solun-pm/solun"
              className="inline-flex items-center gap-2 text-tide-300 hover:text-tide-200 transition"
              target="_blank"
              rel="noreferrer"
              aria-label="Solun on GitHub"
              title="Solun on GitHub"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.1.68-.22.68-.48v-1.7c-2.77.6-3.36-1.2-3.36-1.2-.45-1.16-1.1-1.47-1.1-1.47-.9-.62.07-.61.07-.61 1 .07 1.53 1.04 1.53 1.04.9 1.54 2.36 1.1 2.94.84.09-.66.36-1.1.65-1.35-2.21-.25-4.53-1.1-4.53-4.9 0-1.08.39-1.96 1.03-2.65-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.9-1.29 2.74-1.02 2.74-1.02.56 1.38.21 2.4.1 2.65.64.69 1.03 1.57 1.03 2.65 0 3.8-2.32 4.65-4.54 4.9.37.32.7.93.7 1.88v2.78c0 .27.18.59.69.48A10 10 0 0 0 12 2Z"/>
              </svg>
            </a>
          </div>
        </div>
      </div>
      <Script id="home-jsonld" type="application/ld+json">
        {JSON.stringify(jsonLd)}
      </Script>
    </main>
  );
}

type TextSharePanelProps = {
  mode: PasteMode;
  onModeChange: (mode: PasteMode) => void;
  content: string;
  onContentChange: (value: string) => void;
  bytes: number;
  error: string | null;
  loading: boolean;
  onCreate: () => void;
  result: PasteResult;
  copied: boolean;
  onCopy: () => void;
};

function TextSharePanel({
  mode,
  onModeChange,
  content,
  onContentChange,
  bytes,
  error,
  loading,
  onCreate,
  result,
  copied,
  onCopy
}: TextSharePanelProps) {
  return (
    <>
      <div className="relative inline-flex rounded-full border border-ink-700 bg-ink-700/40 p-1 text-sm">
        <span
          aria-hidden="true"
          className={clsx(
            "absolute inset-y-1 rounded-full bg-tide-500 transition-all duration-300 ease-in-out",
            mode === "quick" - "left-1 right-[calc(50%+2px)]" : "left-[calc(50%+2px)] right-1"
          )}
        />
        {(["quick", "secure"] as PasteMode[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onModeChange(option)}
            className={clsx(
              "relative z-10 w-20 rounded-full py-2 text-center font-medium transition-colors duration-300",
              mode === option - "text-ink-900" : "text-ink-200 hover:text-ink-100"
            )}
          >
            {option === "quick" - "Quick" : "Secure"}
          </button>
        ))}
      </div>

      <div className="relative">
        <textarea
          value={content}
          onChange={(event) => onContentChange(event.target.value)}
          placeholder="Paste your text here..."
          rows={10}
          className="w-full resize-none rounded-2xl border border-ink-700 bg-ink-900/60 p-4 pb-8 text-base text-ink-100 outline-none ring-1 ring-transparent focus:border-tide-400 focus:ring-tide-400/30 transition"
        />
        <div className="pointer-events-none absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs">
          <span className="text-ink-600">{bytes.toLocaleString()} bytes</span>
          <span className={bytes > MAX_PASTE_BYTES - "text-ember-300" : "text-ink-600"}>
            512 KB max
          </span>
        </div>
      </div>

      {error - (
        <div className="rounded-xl border border-ember-400/40 bg-ember-400/10 px-4 py-2 text-sm text-ember-300">
          {error}
        </div>
      ) : null}

      <p className="text-xs text-ink-200/60">
        The message deletes itself after someone opens it â€“ one view, then it's gone forever.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onCreate}
          disabled={loading}
          className={clsx(
            "rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-[0.35em] transition",
            loading
              - "cursor-wait bg-ink-700 text-ink-500"
              : "bg-tide-500 text-ink-900 hover:bg-tide-400"
          )}
        >
          {loading - "Creating..." : "Create"}
        </button>
        <span className="text-xs text-ink-200/60">
          {mode === "secure"
            - "Encrypted in your browser before it leaves â€“ only the recipient can decrypt it."
            : "Encrypted on our servers â€“ only someone with the link can open it."}
        </span>
      </div>

      <div
        className={clsx(
          "overflow-hidden transition-all duration-500 ease-in-out",
          result - "max-h-48 opacity-100" : "max-h-0 opacity-0"
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
                onClick={onCopy}
                className={clsx(
                  "shrink-0 rounded-full border px-4 py-2 text-xs uppercase tracking-[0.3em] transition",
                  copied
                    - "border-tide-400/60 bg-tide-400/10 text-tide-300"
                    : "border-tide-500/40 text-tide-300 hover:bg-tide-500/10"
                )}
              >
                {copied - "Copied!" : "Copy"}
              </button>
            </div>
            <p className="text-xs text-ink-200/60">Burns after first read</p>
          </section>
        )}
      </div>
    </>
  );
}

type FileSharePanelProps = {
  fileMode: FileMode;
  onFileModeChange: (mode: FileMode) => void;
  file: File | null;
  onFileSelect: (file: File) => void;
  fileExpiresIn: FileExpiration;
  onFileExpiresInChange: (value: FileExpiration) => void;
  resumeState: ResumeState | null;
  fileError: string | null;
  isUploadBusy: boolean;
  onUpload: (useResume: boolean) => void;
  progress: ReturnType<typeof useUploadProgress>["progress"];
  fileResult: FileResult;
  fileCopied: boolean;
  onFileCopy: (url: string) => void;
};

function FileSharePanel({
  fileMode,
  onFileModeChange,
  file,
  onFileSelect,
  fileExpiresIn,
  onFileExpiresInChange,
  resumeState,
  fileError,
  isUploadBusy,
  onUpload,
  progress,
  fileResult,
  fileCopied,
  onFileCopy
}: FileSharePanelProps) {
  return (
    <>
      <div className="relative inline-flex rounded-full border border-ink-700 bg-ink-700/40 p-1 text-sm">
        <span
          aria-hidden="true"
          className={clsx(
            "absolute inset-y-1 rounded-full bg-tide-500 transition-all duration-300 ease-in-out",
            fileMode === "quick" - "left-1 right-[calc(50%+2px)]" : "left-[calc(50%+2px)] right-1"
          )}
        />
        {(["quick", "secure"] as FileMode[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onFileModeChange(option)}
            className={clsx(
              "relative z-10 w-20 rounded-full py-2 text-center font-medium transition-colors duration-300",
              fileMode === option - "text-ink-900" : "text-ink-200 hover:text-ink-100"
            )}
          >
            {option === "quick" - "Quick" : "Secure"}
          </button>
        ))}
      </div>

      <DropZone file={file} onFile={(next) => onFileSelect(next)} />

      <div className="space-y-2">
        <label className="space-y-2 text-sm text-ink-200">
          <span className="block text-xs uppercase tracking-[0.3em] text-ink-200">Expires after</span>
          <div className="relative">
            <select
              value={fileExpiresIn}
              onChange={(event) => onFileExpiresInChange(event.target.value as FileExpiration)}
              className="w-full appearance-none rounded-xl border border-ink-700 bg-ink-900/60 px-3 py-2 pr-8 text-ink-100 focus:border-tide-400 outline-none transition"
            >
              {fileExpirationOptions.map((option) => (
                <option key={option.value} value={option.value}>
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
        <p className="text-xs text-ink-200/60">
          The file deletes itself after the first download â€“ and automatically after the time above, whichever comes first.
        </p>
      </div>

      {resumeState - (
        <div className="rounded-xl border border-tide-500/30 bg-tide-500/10 px-4 py-3 text-sm text-tide-200">
          Resume available for this file. Uploaded {resumeState.parts.length}/{resumeState.totalChunks} chunks.
        </div>
      ) : null}

      {fileError - (
        <div className="rounded-xl border border-ember-400/40 bg-ember-400/10 px-4 py-2 text-sm text-ember-300">
          {fileError}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => onUpload(false)}
          className={clsx(
            "rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-[0.35em] transition",
            isUploadBusy
              - "cursor-wait bg-ink-700 text-ink-500"
              : "bg-tide-500 text-ink-900 hover:bg-tide-400"
          )}
          disabled={isUploadBusy}
        >
          {isUploadBusy - "Uploading..." : "Upload"}
        </button>
        {resumeState && fileMode === "secure" - (
          <button
            type="button"
            onClick={() => onUpload(true)}
            className="rounded-full border border-tide-500/40 px-5 py-2 text-xs uppercase tracking-[0.3em] text-tide-300 hover:bg-tide-500/10 transition"
          >
            {progress.status === "error" - "Retry" : "Resume"}
          </button>
        ) : null}
        <span className="text-xs text-ink-200/60">
          {fileMode === "secure"
            - "Encrypted in your browser before it leaves â€“ only the recipient can decrypt it."
            : "Encrypted on our servers â€“ only someone with the link can open it."}
        </span>
      </div>

      {progress.status !== "idle" - (
        <section className="space-y-3 rounded-2xl border border-ink-700 bg-ink-900/60 p-4">
          <div className="flex items-center justify-between text-xs text-ink-200">
            <span className="uppercase tracking-[0.3em]">{progress.status}</span>
            <span>{progress.overallPercent.toFixed(0)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-ink-700">
            <div
              className="h-full bg-tide-500 transition-all"
              style={{ width: `${progress.overallPercent}%` }}
            />
          </div>
          <div className="grid gap-2 text-xs text-ink-200 md:grid-cols-3">
            <span>Speed: {formatSpeed(progress.speedBytesPerSec)}</span>
            <span>ETA: {formatEta(progress.estimatedSecondsLeft)}</span>
            <span>
              {progress.uploadedChunks}/{progress.totalChunks} chunks
            </span>
          </div>
          {progress.status === "error" && progress.errorMessage - (
            <div className="rounded-xl border border-ember-400/40 bg-ember-400/10 px-4 py-2 text-sm text-ember-300">
              {progress.errorMessage}
            </div>
          ) : null}
        </section>
      ) : null}

      {fileResult - (
        <section className="space-y-3 rounded-2xl border border-ink-700 bg-ink-900/60 p-4">
          <p className="text-xs uppercase tracking-[0.35em] text-ink-200">Your link</p>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <code
              className="flex-1 break-all text-sm text-tide-300 blur-sm transition-all duration-200 hover:blur-none select-none hover:select-text cursor-pointer"
              title="Hover to reveal"
            >
              {fileResult.url}
            </code>
            <button
              type="button"
              onClick={() => onFileCopy(fileResult.url)}
              className={clsx(
                "shrink-0 rounded-full border px-4 py-2 text-xs uppercase tracking-[0.3em] transition",
                fileCopied
                  - "border-tide-400/60 bg-tide-400/10 text-tide-300"
                  : "border-tide-500/40 text-tide-300 hover:bg-tide-500/10"
              )}
            >
              {fileCopied - "Copied!" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-ink-200/60">Burns after first download</p>
        </section>
      ) : null}
    </>
  );
}
