import { useCallback, useRef, useState } from "react";

export type UploadProgress = {
  status: "idle" | "encrypting" | "uploading" | "finalizing" | "done" | "error";
  totalChunks: number;
  currentChunk: number;
  encryptedChunks: number;
  uploadedChunks: number;
  percentEncrypted: number;
  percentUploaded: number;
  overallPercent: number;
  bytesUploaded: number;
  totalBytes: number;
  speedBytesPerSec: number;
  estimatedSecondsLeft: number;
  errorMessage?: string;
};

const initialProgress: UploadProgress = {
  status: "idle",
  totalChunks: 0,
  currentChunk: 0,
  encryptedChunks: 0,
  uploadedChunks: 0,
  percentEncrypted: 0,
  percentUploaded: 0,
  overallPercent: 0,
  bytesUploaded: 0,
  totalBytes: 0,
  speedBytesPerSec: 0,
  estimatedSecondsLeft: 0
};

type SpeedSample = { timestamp: number; bytes: number };

export function useUploadProgress() {
  const [progress, setProgress] = useState<UploadProgress>(initialProgress);
  const speedWindow = useRef<SpeedSample[]>([]);

  const recompute = useCallback((next: UploadProgress): UploadProgress => {
    const percentEncrypted = next.totalChunks
      ? Math.min(100, (next.encryptedChunks / next.totalChunks) * 100)
      : 0;
    const percentUploaded = next.totalChunks
      ? Math.min(100, (next.uploadedChunks / next.totalChunks) * 100)
      : 0;
    const overallPercent = Math.min(100, percentEncrypted * 0.3 + percentUploaded * 0.7);

    let speedBytesPerSec = next.speedBytesPerSec;
    let estimatedSecondsLeft = next.estimatedSecondsLeft;

    if (speedWindow.current.length >= 2) {
      const first = speedWindow.current[0];
      const last = speedWindow.current[speedWindow.current.length - 1];
      const deltaSeconds = Math.max(0.001, (last.timestamp - first.timestamp) / 1000);
      const bytes = speedWindow.current.reduce((sum, sample) => sum + sample.bytes, 0);
      speedBytesPerSec = bytes / deltaSeconds;
      estimatedSecondsLeft = speedBytesPerSec > 0
        ? Math.max(0, (next.totalBytes - next.bytesUploaded) / speedBytesPerSec)
        : 0;
    }

    return {
      ...next,
      percentEncrypted,
      percentUploaded,
      overallPercent,
      speedBytesPerSec,
      estimatedSecondsLeft
    };
  }, []);

  const reset = useCallback(() => {
    speedWindow.current = [];
    setProgress(initialProgress);
  }, []);

  const setTotals = useCallback((totalBytes: number, totalChunks: number) => {
    setProgress((prev) =>
      recompute({
        ...prev,
        totalBytes,
        totalChunks,
        bytesUploaded: 0,
        encryptedChunks: 0,
        uploadedChunks: 0,
        currentChunk: 0
      })
    );
  }, [recompute]);

  const setStatus = useCallback((status: UploadProgress["status"]) => {
    setProgress((prev) => ({ ...prev, status }));
  }, []);

  const setError = useCallback((message: string) => {
    setProgress((prev) => ({ ...prev, status: "error", errorMessage: message }));
  }, []);

  const markEncrypted = useCallback((chunkIndex: number) => {
    setProgress((prev) =>
      recompute({
        ...prev,
        status: "encrypting",
        encryptedChunks: Math.min(prev.totalChunks, prev.encryptedChunks + 1),
        currentChunk: chunkIndex
      })
    );
  }, [recompute]);

  const setEncryptedChunks = useCallback((count: number) => {
    setProgress((prev) =>
      recompute({
        ...prev,
        encryptedChunks: Math.min(prev.totalChunks, count)
      })
    );
  }, [recompute]);

  const markUploaded = useCallback((chunkIndex: number, bytes: number) => {
    speedWindow.current.push({ timestamp: Date.now(), bytes });
    if (speedWindow.current.length > 5) {
      speedWindow.current.shift();
    }

    setProgress((prev) =>
      recompute({
        ...prev,
        status: "uploading",
        uploadedChunks: Math.min(prev.totalChunks, prev.uploadedChunks + 1),
        bytesUploaded: Math.min(prev.totalBytes, prev.bytesUploaded + bytes),
        currentChunk: chunkIndex
      })
    );
  }, [recompute]);

  const setUploadedBytes = useCallback((bytesUploaded: number) => {
    setProgress((prev) => {
      const delta = Math.max(0, bytesUploaded - prev.bytesUploaded);
      if (delta > 0) {
        speedWindow.current.push({ timestamp: Date.now(), bytes: delta });
        if (speedWindow.current.length > 5) {
          speedWindow.current.shift();
        }
      }

      return recompute({
        ...prev,
        status: prev.status === "idle" ? "uploading" : prev.status,
        bytesUploaded: Math.min(prev.totalBytes, bytesUploaded),
        uploadedChunks: prev.totalChunks
          ? Math.min(prev.totalChunks, Math.ceil(bytesUploaded / (prev.totalBytes / prev.totalChunks || 1)))
          : 0
      });
    });
  }, [recompute]);

  const setFinalizing = useCallback(() => {
    setProgress((prev) => ({ ...prev, status: "finalizing" }));
  }, []);

  const setDone = useCallback(() => {
    setProgress((prev) =>
      recompute({
        ...prev,
        status: "done",
        percentUploaded: 100,
        percentEncrypted: 100,
        uploadedChunks: prev.totalChunks,
        encryptedChunks: prev.totalChunks,
        bytesUploaded: prev.totalBytes
      })
    );
  }, [recompute]);

  return {
    progress,
    reset,
    setTotals,
    setStatus,
    setError,
    markEncrypted,
    setEncryptedChunks,
    markUploaded,
    setUploadedBytes,
    setFinalizing,
    setDone
  };
}
