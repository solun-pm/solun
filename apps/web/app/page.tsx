"use client";

import clsx from "clsx";
import Image from "next/image";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { FileExpiration, FileMetadata, FileMode, PasteMode } from "@solun/shared";
import { FILE_CHUNK_SIZE, MAX_FILE_BYTES, MAX_PASTE_BYTES } from "@solun/shared";
import { encrypt, exportKey, generateKey, importKey } from "../lib/crypto";
import { getByteLength, validateCreatePayload } from "../lib/validation";
import { encryptChunk } from "../lib/file-crypto";
import { useUploadProgress } from "../lib/hooks/useUploadProgress";
import ShareSwitch, { type ShareKind } from "./components/share-switch";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

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
    const next = event.target.files?.[0];
    if (next) onFile(next);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="File drop zone"
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={clsx(
        "flex h-36 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed transition-all duration-200",
        dragging
          ? "border-tide-400 bg-tide-400/5 scale-[1.01]"
          : file
            ? "border-tide-500/40 bg-ink-900/40"
            : "border-ink-700 bg-ink-900/40 hover:border-ink-600 hover:bg-ink-900/60"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleChange}
      />
      {file ? (
        <>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-tide-400" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <span className="max-w-[90%] truncate text-sm font-medium text-ink-100">{file.name}</span>
          <span className={clsx("text-xs", file.size > MAX_FILE_BYTES ? "text-ember-300" : "text-ink-400")}>
            {formatBytes(file.size)}{file.size > MAX_FILE_BYTES ? " – exceeds 500 MB limit" : ""}
          </span>
        </>
      ) : (
        <>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-ink-500" aria-hidden="true">
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

  const [mode, setMode] = useState<PasteMode>("quick");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; expiresAt: string | null } | null>(null);
  const [copied, setCopied] = useState(false);
  const [linkToast, setLinkToast] = useState(false);

  const [fileMode, setFileMode] = useState<FileMode>("quick");
  const [fileExpiresIn, setFileExpiresIn] = useState<FileExpiration>("24h");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileResult, setFileResult] = useState<{ url: string; expiresAt: string } | null>(null);
  const [resumeState, setResumeState] = useState<ResumeState | null>(null);
  const [fileCopied, setFileCopied] = useState(false);
  const [fileLinkToast, setFileLinkToast] = useState(false);

  const bytes = useMemo(() => getByteLength(content), [content]);
  const fileChunks = useMemo(() => (file ? Math.ceil(file.size / FILE_CHUNK_SIZE) : 0), [file]);
  const textPanelRef = useRef<HTMLDivElement | null>(null);
  const filesPanelRef = useRef<HTMLDivElement | null>(null);
  const [panelHeight, setPanelHeight] = useState<number | null>(null);
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

  const isUploadBusy =
    progress.status === "encrypting" || progress.status === "uploading" || progress.status === "finalizing";

  useEffect(() => {
    if (!file || shareKind !== "files" || fileMode !== "secure") {
      setResumeState(null);
      return;
    }
    setResumeState(loadResumeState(file));
  }, [file, shareKind, fileMode]);

  useLayoutEffect(() => {
    const activeRef = shareKind === "files" ? filesPanelRef.current : textPanelRef.current;
    if (!activeRef) return;
    setPanelHeight(activeRef.scrollHeight);
  }, [shareKind, content, bytes, file, fileChunks, result, fileResult, error, fileError, progress.status]);

  useEffect(() => {
    const activeRef = shareKind === "files" ? filesPanelRef.current : textPanelRef.current;
    if (!activeRef) return;
    const observer = new ResizeObserver(() => {
      setPanelHeight(activeRef.scrollHeight);
    });
    observer.observe(activeRef);
    return () => observer.disconnect();
  }, [shareKind]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(t);
  }, [copied]);

  useEffect(() => {
    if (!fileCopied) return;
    const t = setTimeout(() => setFileCopied(false), 2500);
    return () => clearTimeout(t);
  }, [fileCopied]);

  useEffect(() => {
    if (!fileLinkToast) return;
    const t = setTimeout(() => setFileLinkToast(false), 3000);
    return () => clearTimeout(t);
  }, [fileLinkToast]);

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
        ttl: "burn" as const,
        burnAfterRead: true,
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
    setResult(null);
    setCopied(false);
  }

  async function handleQuickUpload(selected: File) {
    setFileError(null);
    setTotals(selected.size, fileChunks);
    setEncryptedChunks(fileChunks);

    return new Promise<void>((resolve) => {
      const formData = new FormData();
      formData.append("expiresIn", fileExpiresIn);
      formData.append("file", selected);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_URL}/api/files/quick`);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setUploadedBytes(event.loaded);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const data = JSON.parse(xhr.responseText) as { id: string; expiresAt: string | null };
          const url = `${window.location.origin}/f/${data.id}`;
          setFileResult({ url, expiresAt: data.expiresAt ?? "" });
          setFileLinkToast(true);
          setDone();
          resolve();
        } else {
          setFileError("Upload failed.");
          setUploadError("Upload failed.");
          resolve();
        }
      };

      xhr.onerror = () => {
        setFileError("Upload failed.");
        setUploadError("Upload failed.");
        resolve();
      };

      xhr.send(formData);
    });
  }

  async function handleSecureUpload(selected: File, resume: ResumeState | null) {
    setFileError(null);
    setTotals(selected.size, fileChunks);

    const cryptoKey = resume ? await importKey(resume.key) : await generateKey();
    const keyFragment = resume?.key ?? (await exportKey(cryptoKey));

    let uploadId = resume?.uploadId ?? null;
    let fileId = resume?.id ?? null;
    let r2Key = resume?.r2Key ?? null;
    let metadataKey = resume?.metadataKey ?? null;
    let partSize = resume?.partSize ?? FILE_CHUNK_SIZE;
    const parts = resume?.parts ? [...resume.parts] : [];
    const ivs = resume?.ivs ? [...resume.ivs] : [];
    let expiresAt = resume?.expiresAt ?? "";

    if (!resume) {
      const response = await fetch(`${API_URL}/api/files/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "secure",
          expiresIn: fileExpiresIn,
          sizeBytes: selected.size,
          contentType: selected.type || "application/octet-stream",
          originalName: selected.name,
          burnAfterRead: true
        })
      });

      if (!response.ok) {
        throw new Error("Failed to initiate upload.");
      }

      const data = (await response.json()) as {
        id: string;
        uploadId: string;
        r2Key: string;
        metadataKey: string;
        partSize: number;
        expiresAt: string;
      };

      uploadId = data.uploadId;
      fileId = data.id;
      r2Key = data.r2Key;
      metadataKey = data.metadataKey;
      partSize = data.partSize;
      expiresAt = data.expiresAt;

      saveResumeState(selected, {
        id: data.id,
        uploadId: data.uploadId,
        r2Key: data.r2Key,
        metadataKey: data.metadataKey,
        partSize: data.partSize,
        totalChunks: fileChunks,
        fileFingerprint: fingerprintFile(selected),
        parts: [],
        ivs: [],
        expiresAt: data.expiresAt,
        key: keyFragment
      });
    }

    if (!uploadId || !fileId || !r2Key || !metadataKey) {
      throw new Error("Missing upload session.");
    }

    const uploadedPartNumbers = new Set(parts.map((part) => part.partNumber));
    setEncryptedChunks(ivs.length);
    const uploadedBytes = parts.reduce((sum, part) => {
      const chunkSize = part.partNumber === fileChunks
        ? selected.size - (fileChunks - 1) * partSize
        : partSize;
      return sum + chunkSize;
    }, 0);
    setUploadedBytes(uploadedBytes);

    const missingParts = [] as number[];
    for (let i = 1; i <= fileChunks; i += 1) {
      if (!uploadedPartNumbers.has(i)) {
        missingParts.push(i);
      }
    }

    const urlMap = new Map<number, string>();
    if (missingParts.length > 0) {
      const presignResponse = await fetch(`${API_URL}/api/files/presign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: fileId, uploadId, partNumbers: missingParts })
      });

      if (!presignResponse.ok) {
        if (presignResponse.status === 404 || presignResponse.status === 400) {
          clearResumeState(selected);
          throw new Error("Upload expired. Start again.");
        }
        throw new Error("Failed to presign upload.");
      }

      const presigned = (await presignResponse.json()) as { urls: { partNumber: number; url: string }[] };
      presigned.urls.forEach((item) => urlMap.set(item.partNumber, item.url));
    }

    let inFlightUpload: Promise<void> | null = null;
    for (let partNumber = 1; partNumber <= fileChunks; partNumber += 1) {
      if (uploadedPartNumbers.has(partNumber)) {
        continue;
      }
      const start = (partNumber - 1) * partSize;
      const end = Math.min(selected.size, start + partSize);
      const chunk = selected.slice(start, end);

      setStatus("encrypting");
      const encrypted = await encryptChunk(await chunk.arrayBuffer(), cryptoKey);
      ivs[partNumber - 1] = encrypted.iv;
      markEncrypted(partNumber);

      const uploadUrl = urlMap.get(partNumber);
      if (!uploadUrl) {
        throw new Error("Missing presigned URL.");
      }

      setStatus("uploading");
      const uploadTask = (async () => {
        const payload = encrypted.ciphertext.buffer.slice(
          encrypted.ciphertext.byteOffset,
          encrypted.ciphertext.byteOffset + encrypted.ciphertext.byteLength
        ) as ArrayBuffer;
        const uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          body: new Blob([payload])
        });

        if (!uploadResponse.ok) {
          const details = await uploadResponse.text().catch(() => "");
          console.error("Upload part failed", {
            partNumber,
            status: uploadResponse.status,
            statusText: uploadResponse.statusText,
            details
          });
          throw new Error(`Upload failed on part ${partNumber}.`);
        }

        const etag = uploadResponse.headers.get("ETag") || uploadResponse.headers.get("etag");
        if (!etag) {
          const headerList: Array<[string, string]> = [];
          uploadResponse.headers.forEach((value, key) => headerList.push([key, value]));
          console.error("Missing ETag header", {
            partNumber,
            headers: headerList
          });
          throw new Error(`Missing ETag for part ${partNumber}.`);
        }

        parts.push({ partNumber, etag });
        uploadedPartNumbers.add(partNumber);
        markUploaded(partNumber, end - start);

        saveResumeState(selected, {
          id: fileId,
          uploadId,
          r2Key,
          metadataKey,
          partSize,
          totalChunks: fileChunks,
          fileFingerprint: fingerprintFile(selected),
          parts,
          ivs,
          expiresAt,
          key: keyFragment
        });
      })();

      if (inFlightUpload) {
        await inFlightUpload;
      }
      inFlightUpload = uploadTask;
    }

    if (inFlightUpload) {
      await inFlightUpload;
    }

    setFinalizing();

    const completeResponse = await fetch(`${API_URL}/api/files/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: fileId, uploadId, parts })
    });

    if (!completeResponse.ok) {
      throw new Error("Failed to complete upload.");
    }

    const metadata: FileMetadata = {
      chunkSize: partSize,
      totalSize: selected.size,
      totalChunks: fileChunks,
      ivs
    };

    const metadataResponse = await fetch(`${API_URL}/api/files/metadata`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: fileId, metadata })
    });

    if (!metadataResponse.ok) {
      throw new Error("Failed to store metadata.");
    }

    clearResumeState(selected);

    const url = `${window.location.origin}/f/${fileId}#key=${keyFragment}`;
    setFileResult({ url, expiresAt });
    setFileLinkToast(true);
    setDone();
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
        await handleSecureUpload(file, useResume ? resumeState : null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed.";
      setFileError(message);
      setUploadError(message);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div
        className={clsx(
          "pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-tide-400/30 bg-ink-800/90 px-5 py-2.5 text-sm text-tide-300 shadow-glow-sm backdrop-blur transition-all duration-300",
          fileCopied ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        )}
      >
        Link copied to clipboard
      </div>

      <div
        className={clsx(
          "pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-tide-400/30 bg-ink-800/90 px-5 py-2.5 text-sm text-tide-300 shadow-glow-sm backdrop-blur transition-all duration-300",
          fileLinkToast && !fileCopied ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        )}
      >
        ✓ Link created
      </div>

      <div
        className={clsx(
          "pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-tide-400/30 bg-ink-800/90 px-5 py-2.5 text-sm text-tide-300 shadow-glow-sm backdrop-blur transition-all duration-300",
          copied ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        )}
      >
        Link copied to clipboard
      </div>

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
              Quick mode keeps it fast. Secure mode encrypts in your browser – the server never sees the key.
            </p>
          </div>
        </header>
        <ShareSwitch value={shareKind} onChange={setShareKind} />

        <div
          className="relative transition-[height] duration-700 ease-[cubic-bezier(0.16,0.84,0.44,1)] will-change-[height]"
          style={panelHeight ? { height: `${panelHeight}px` } : undefined}
        >
          <section
            ref={textPanelRef}
            className={clsx(
              "absolute inset-x-0 top-0 space-y-4 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.16,0.84,0.44,1)]",
              shareKind === "text"
                ? "opacity-100 translate-y-0 pointer-events-auto"
                : "opacity-0 translate-y-1 pointer-events-none"
            )}
          >
            <div className="relative inline-flex rounded-full border border-ink-700 bg-ink-700/40 p-1 text-sm">
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

            <div className="relative">
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Paste your text here..."
                rows={10}
                className="w-full resize-none rounded-2xl border border-ink-700 bg-ink-900/60 p-4 pb-8 text-base text-ink-100 outline-none ring-1 ring-transparent focus:border-tide-400 focus:ring-tide-400/30 transition"
              />
              <div className="pointer-events-none absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs">
                <span className="text-ink-600">{bytes.toLocaleString()} bytes</span>
                <span className={bytes > MAX_PASTE_BYTES ? "text-ember-300" : "text-ink-600"}>
                  512 KB max
                </span>
              </div>
            </div>

            {error ? (
              <div className="rounded-xl border border-ember-400/40 bg-ember-400/10 px-4 py-2 text-sm text-ember-300">
                {error}
              </div>
            ) : null}

            <p className="text-xs text-ink-200/60">
              The message deletes itself after someone opens it – one view, then it's gone forever.
            </p>

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
                {mode === "secure"
                  ? "Encrypted in your browser before it leaves – only the recipient can decrypt it."
                  : "Encrypted on our servers – only someone with the link can open it."}
              </span>
            </div>

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
                  <p className="text-xs text-ink-200/60">Burns after first read</p>
                </section>
              )}
            </div>
          </section>

          <section
            ref={filesPanelRef}
            className={clsx(
              "absolute inset-x-0 top-0 space-y-4 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.16,0.84,0.44,1)]",
              shareKind === "files"
                ? "opacity-100 translate-y-0 pointer-events-auto"
                : "opacity-0 translate-y-1 pointer-events-none"
            )}
          >
            <div className="relative inline-flex rounded-full border border-ink-700 bg-ink-700/40 p-1 text-sm">
              <span
                aria-hidden="true"
                className={clsx(
                  "absolute inset-y-1 rounded-full bg-tide-500 transition-all duration-300 ease-in-out",
                  fileMode === "quick" ? "left-1 right-[calc(50%+2px)]" : "left-[calc(50%+2px)] right-1"
                )}
              />
              {(["quick", "secure"] as FileMode[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setFileMode(option);
                    setFileError(null);
                    setFileResult(null);
                  }}
                  className={clsx(
                    "relative z-10 w-20 rounded-full py-2 text-center font-medium transition-colors duration-300",
                    fileMode === option ? "text-ink-900" : "text-ink-200 hover:text-ink-100"
                  )}
                >
                  {option === "quick" ? "Quick" : "Secure"}
                </button>
              ))}
            </div>

            <DropZone
              file={file}
              onFile={(next) => {
                setFile(next);
                setFileError(null);
                setFileResult(null);
                resetUploadProgress();
              }}
            />

            <div className="space-y-2">
              <label className="space-y-2 text-sm text-ink-200">
                <span className="block text-xs uppercase tracking-[0.3em] text-ink-200">Expires after</span>
                <div className="relative">
                  <select
                    value={fileExpiresIn}
                    onChange={(event) => setFileExpiresIn(event.target.value as FileExpiration)}
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
                The file deletes itself after the first download – and automatically after the time above, whichever comes first.
              </p>
            </div>

            {resumeState ? (
              <div className="rounded-xl border border-tide-500/30 bg-tide-500/10 px-4 py-3 text-sm text-tide-200">
                Resume available for this file. Uploaded {resumeState.parts.length}/{resumeState.totalChunks} chunks.
              </div>
            ) : null}

            {fileError ? (
              <div className="rounded-xl border border-ember-400/40 bg-ember-400/10 px-4 py-2 text-sm text-ember-300">
                {fileError}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => handleFileUpload(false)}
                className={clsx(
                  "rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-[0.35em] transition",
                  isUploadBusy
                    ? "cursor-wait bg-ink-700 text-ink-500"
                    : "bg-tide-500 text-ink-900 hover:bg-tide-400"
                )}
                disabled={isUploadBusy}
              >
                {isUploadBusy ? "Uploading..." : "Upload"}
              </button>
              {resumeState && fileMode === "secure" ? (
                <button
                  type="button"
                  onClick={() => handleFileUpload(true)}
                  className="rounded-full border border-tide-500/40 px-5 py-2 text-xs uppercase tracking-[0.3em] text-tide-300 hover:bg-tide-500/10 transition"
                >
                  {progress.status === "error" ? "Retry" : "Resume"}
                </button>
              ) : null}
              <span className="text-xs text-ink-200/60">
                {fileMode === "secure"
                  ? "Encrypted in your browser before it leaves – only the recipient can decrypt it."
                  : "Encrypted on our servers – only someone with the link can open it."}
              </span>
            </div>

            {progress.status !== "idle" ? (
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
                {progress.status === "error" && progress.errorMessage ? (
                  <div className="rounded-xl border border-ember-400/40 bg-ember-400/10 px-4 py-2 text-sm text-ember-300">
                    {progress.errorMessage}
                  </div>
                ) : null}
              </section>
            ) : null}

          {fileResult ? (
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
                    onClick={async () => {
                      await navigator.clipboard.writeText(fileResult.url);
                      setFileCopied(true);
                    }}
                    className={clsx(
                      "shrink-0 rounded-full border px-4 py-2 text-xs uppercase tracking-[0.3em] transition",
                      fileCopied
                        ? "border-tide-400/60 bg-tide-400/10 text-tide-300"
                        : "border-tide-500/40 text-tide-300 hover:bg-tide-500/10"
                    )}
                  >
                    {fileCopied ? "Copied!" : "Copy"}
                  </button>
                </div>
              <p className="text-xs text-ink-200/60">Burns after first download</p>
            </section>
          ) : null}
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-700 pt-6 text-xs text-ink-200/70">
          <span>Made with love by the Solun team ♥ </span>
          <div className="flex items-center gap-4">
            <a href="/learn" className="text-tide-300 hover:text-tide-200 transition">
              Learn
            </a>
            <a href="/roadmap" className="text-tide-300 hover:text-tide-200 transition">
              Roadmap
            </a>
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </main>
  );
}
