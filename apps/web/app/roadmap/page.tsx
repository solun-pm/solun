import Link from "next/link";

export const metadata = {
  title: "Roadmap",
  description: "What Solun is building next: privacy-first sharing with clear, near-term priorities."
};

const roadmap = {
  now: [
    {
      title: "Burn-after-read hardening",
      details: [
        "Guarantee deletion after the first successful access.",
        "Reduce risk from link previews and prefetching."
      ]
    },
    {
      title: "Download guardrails",
      details: [
        "Reveal-first flow for files and messages.",
        "Clear messaging when a share is expired or already burned."
      ]
    }
  ],
  next: [
    {
      title: "CLI tool for secure sharing",
      details: [
        "Share pastes and files from servers or CI.",
        "Curl-friendly upload and download flows."
      ]
    }
  ],
  later: [
    {
      title: "Coming soon",
      details: [
        "We are collecting feedback for the next milestones.",
        "Open an issue to influence what lands next."
      ]
    }
  ]
};

export default function RoadmapPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Solun Roadmap",
    description: "Upcoming features for privacy-first paste and file sharing.",
    url: "https://solun.pm/roadmap",
    publisher: { "@type": "Organization", name: "Solun" }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-4xl space-y-8 rounded-3xl border border-ink-700 bg-ink-800/70 p-8 shadow-glow backdrop-blur">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.4em] text-tide-300/70">Solun · Roadmap</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink-100">What we are building next</h1>
          <p className="text-sm text-ink-200">
            This roadmap is focused on privacy-first sharing, secure defaults, and workflows teams can trust.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-3">
          {([
            { label: "Now", items: roadmap.now },
            { label: "Next", items: roadmap.next },
            { label: "Coming Soon", items: roadmap.later }
          ] as const).map((column) => (
            <div key={column.label} className="space-y-4 rounded-2xl border border-ink-700 bg-ink-900/60 p-4">
              <h2 className="text-sm uppercase tracking-[0.3em] text-tide-300/80">{column.label}</h2>
              <div className="space-y-4">
                {column.items.map((item) => (
                  <div key={item.title} className="space-y-2">
                    <h3 className="text-base font-semibold text-ink-100">{item.title}</h3>
                    <ul className="space-y-1 text-sm text-ink-200">
                      {item.details.map((detail) => (
                        <li key={detail} className="flex gap-2">
                          <span className="text-tide-300">•</span>
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="space-y-3 border-t border-ink-700 pt-6 text-sm text-ink-200">
          <Link href="/" className="text-tide-300 hover:text-tide-200 transition">
            Back to Solun
          </Link>
          <p>
            Want to influence the roadmap? Open an issue or drop feedback on GitHub. We build fast when the use case
            is clear.
          </p>
          <div className="flex flex-wrap items-center gap-4 text-xs uppercase tracking-[0.3em]">
            <Link href="/learn" className="text-tide-300 hover:text-tide-200 transition">
              Learn
            </Link>
            <a
              href="https://github.com/solun-pm/solun"
              className="text-tide-300 hover:text-tide-200 transition"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </div>
        </section>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </main>
  );
}
