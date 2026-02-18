import { notFound } from "next/navigation";
import type { PasteRecord } from "@solun/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default async function QuickPastePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const response = await fetch(`${API_URL}/api/paste/${id}`, { cache: "no-store" });
  if (!response.ok) {
    return notFound();
  }
  const data = (await response.json()) as PasteRecord;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl space-y-6 rounded-3xl border border-ink-700 bg-ink-800/70 p-8 shadow-glow backdrop-blur">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.4em] text-tide-300/70">Solun · Quick</p>
          <h1 className="text-3xl font-semibold text-ink-100">Paste {data.id}</h1>
          <p className="text-ink-200">Shared in quick mode. Encrypted at rest, decrypted on delivery.</p>
        </header>

        <textarea
          readOnly
          value={data.content}
          rows={12}
          className="w-full resize-none rounded-2xl border border-ink-700 bg-ink-900/60 p-4 text-base text-ink-100"
        />

        <div className="flex flex-wrap items-center gap-3 text-xs text-ink-400">
          <span>Mode: {data.mode}</span>
          {data.expiresAt ? (
            <span>Expires: {new Date(data.expiresAt).toLocaleString()}</span>
          ) : (
            <span>No expiration</span>
          )}
        </div>
      </div>
    </main>
  );
}
