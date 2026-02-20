import { useCallback, useRef, useState } from "react";

export type DownloadProgress = {
  status: "idle" | "downloading" | "decrypting" | "assembling" | "done" | "error";
  totalChunks: number;
  currentChunk: number;
  downloadedChunks: number;
  decryptedChunks: number;
  percentDownloaded: number;
  percentDecrypted: number;
  overallPercent: number;
  bytesDownloaded: number;
  totalBytes: number;
  speedBytesPerSec: number;
  estimatedSecondsLeft: number;
  errorMessage?: string;
};

const initialProgress: DownloadProgress = {
  status: "idle",
  totalChunks: 0,
  currentChunk: 0,
  downloadedChunks: 0,
  decryptedChunks: 0,
  percentDownloaded: 0,
  percentDecrypted: 0,
  overallPercent: 0,
  bytesDownloaded: 0,
  totalBytes: 0,
  speedBytesPerSec: 0,
  estimatedSecondsLeft: 0
};

type SpeedSample = { timestamp: number; bytes: number };

export function useDownloadProgress() {
  const [progress, setProgress] = useState<DownloadProgress>(initialProgress);
  const speedWindow = useRef<SpeedSample[]>([]);

  const recompute = useCallback((next: DownloadProgress): DownloadProgress => {
    const percentDownloaded = next.totalChunks
      ? Math.min(100, (next.downloadedChunks / next.totalChunks) * 100)
      : 0;
    const percentDecrypted = next.totalChunks
      ? Math.min(100, (next.decryptedChunks / next.totalChunks) * 100)
      : 0;
    const overallPercent = Math.min(100, percentDecrypted * 0.3 + percentDownloaded * 0.7);

    let speedBytesPerSec = next.speedBytesPerSec;
    let estimatedSecondsLeft = next.estimatedSecondsLeft;

    if (speedWindow.current.length >= 2) {
      const first = speedWindow.current[0];
      const last = speedWindow.current[speedWindow.current.length - 1];
      const deltaSeconds = Math.max(0.001, (last.timestamp - first.timestamp) / 1000);
      const bytes = speedWindow.current.reduce((sum, sample) => sum + sample.bytes, 0);
      speedBytesPerSec = bytes / deltaSeconds;
      estimatedSecondsLeft = speedBytesPerSec > 0
        ? Math.max(0, (next.totalBytes - next.bytesDownloaded) / speedBytesPerSec)
        : 0;
    }

    return {
      ...next,
      percentDownloaded,
      percentDecrypted,
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
        bytesDownloaded: 0,
        downloadedChunks: 0,
        decryptedChunks: 0,
        currentChunk: 0
      })
    );
  }, [recompute]);

  const setStatus = useCallback((status: DownloadProgress["status"]) => {
    setProgress((prev) => ({ ...prev, status }));
  }, []);

  const setError = useCallback((message: string) => {
    setProgress((prev) => ({ ...prev, status: "error", errorMessage: message }));
  }, []);

  const markDownloaded = useCallback((chunkIndex: number, bytes: number) => {
    speedWindow.current.push({ timestamp: Date.now(), bytes });
    if (speedWindow.current.length > 5) {
      speedWindow.current.shift();
    }

    setProgress((prev) =>
      recompute({
        ...prev,
        status: "downloading",
        downloadedChunks: Math.min(prev.totalChunks, prev.downloadedChunks + 1),
        bytesDownloaded: Math.min(prev.totalBytes, prev.bytesDownloaded + bytes),
        currentChunk: chunkIndex
      })
    );
  }, [recompute]);

  const markDecrypted = useCallback((chunkIndex: number) => {
    setProgress((prev) =>
      recompute({
        ...prev,
        status: "decrypting",
        decryptedChunks: Math.min(prev.totalChunks, prev.decryptedChunks + 1),
        currentChunk: chunkIndex
      })
    );
  }, [recompute]);

  const setAssembling = useCallback(() => {
    setProgress((prev) => ({ ...prev, status: "assembling" }));
  }, []);

  const setDone = useCallback(() => {
    setProgress((prev) =>
      recompute({
        ...prev,
        status: "done",
        downloadedChunks: prev.totalChunks,
        decryptedChunks: prev.totalChunks,
        bytesDownloaded: prev.totalBytes
      })
    );
  }, [recompute]);

  return {
    progress,
    reset,
    setTotals,
    setStatus,
    setError,
    markDownloaded,
    markDecrypted,
    setAssembling,
    setDone
  };
}
