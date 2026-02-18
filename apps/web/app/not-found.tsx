import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl space-y-6 rounded-3xl border border-ink-700 bg-ink-800/70 p-8 shadow-glow backdrop-blur">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.4em] text-tide-300/70">Solun</p>
          <h1 className="text-3xl font-semibold text-ink-100">Message not found</h1>
          <p className="text-ink-200">
            This message does not exist or has already been read and deleted.
          </p>
        </header>

        <div className="border-t border-ink-700 pt-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-tide-400 to-tide-600 px-5 py-2.5 text-sm font-medium text-white shadow-glow-sm transition hover:opacity-90"
          >
            <span>+</span>
            Create new message
          </Link>
        </div>
      </div>
    </main>
  );
}
