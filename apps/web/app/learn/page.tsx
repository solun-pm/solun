import Link from "next/link";
import { learnArticles } from "./content";

export const metadata = {
  title: "Learn",
  description: "Guides for secure paste and file sharing with privacy-first practices."
};

export default function LearnIndexPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-4xl space-y-6 rounded-3xl border border-ink-700 bg-ink-800/70 p-8 shadow-glow backdrop-blur">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.4em] text-tide-300/70">Solun · Learn</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink-100">Privacy-first sharing guides</h1>
          <p className="text-sm text-ink-200">
            Practical, deep guides for secure paste and file sharing. No fluff, just clear steps and rationale.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <Link
            href="/learn/overview"
            className="rounded-2xl border border-tide-500/40 bg-ink-900/60 p-4 transition hover:border-tide-400/70"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-tide-300/70">Start here</p>
            <h2 className="mt-2 text-lg font-semibold text-ink-100">The Solun guide to private sharing</h2>
            <p className="mt-2 text-sm text-ink-200">
              A pillar page that links the essential guides for safe, private sharing.
            </p>
            <span className="mt-3 inline-flex text-xs uppercase tracking-[0.3em] text-tide-300/70">
              Read overview
            </span>
          </Link>
          {learnArticles.map((article) => (
            <Link
              key={article.slug}
              href={`/learn/${article.slug}`}
              className="rounded-2xl border border-ink-700 bg-ink-900/60 p-4 transition hover:border-tide-400/50"
            >
              <h2 className="text-lg font-semibold text-ink-100">{article.title}</h2>
              <p className="mt-2 text-sm text-ink-200">{article.description}</p>
              <span className="mt-3 inline-flex text-xs uppercase tracking-[0.3em] text-tide-300/70">
                Read guide
              </span>
            </Link>
          ))}
        </section>

        <div className="border-t border-ink-700 pt-6 text-xs text-ink-200/70 space-y-3">
          <Link href="/" className="inline-flex text-tide-300 hover:text-tide-200 transition">
            Back to Solun
          </Link>
          <div>Use these guides to choose the right mode, set safe expirations, and share with confidence.</div>
        </div>
      </div>
    </main>
  );
}
