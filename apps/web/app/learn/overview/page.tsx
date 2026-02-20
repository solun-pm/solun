import Link from "next/link";

export const metadata = {
  title: "Solun Guide",
  description: "A pillar guide to privacy-first paste and file sharing with secure defaults and short-lived links.",
  alternates: {
    canonical: "https://solun.pm/learn/overview"
  },
  openGraph: {
    title: "Solun Guide · Solun",
    description: "A pillar guide to privacy-first paste and file sharing with secure defaults and short-lived links.",
    url: "https://solun.pm/learn/overview",
    type: "article"
  }
};

const sections = [
  {
    title: "Choose the right mode",
    body: [
      "Quick mode is fast and convenient when speed matters and server-side encryption is acceptable.",
      "Secure mode keeps the key in your browser, so the server never sees it."
    ],
    links: [
      { href: "/learn/secure-paste-sharing", label: "Secure paste sharing" },
      { href: "/learn/end-to-end-encryption-basics", label: "End-to-end encryption" }
    ]
  },
  {
    title: "Set safe expirations",
    body: [
      "Short TTLs reduce the chance of long-term exposure.",
      "Burn-after-read is ideal for secrets that should be accessed only once."
    ],
    links: [
      { href: "/learn/burn-after-read-and-expiration", label: "Burn-after-read and expiration" },
      { href: "/learn/compliance-and-retention", label: "Retention basics" }
    ]
  },
  {
    title: "Share without leaks",
    body: [
      "Avoid link previews and send context separately from the link.",
      "URL fragments keep keys out of server logs and analytics."
    ],
    links: [
      { href: "/learn/private-link-sharing", label: "Private link sharing" },
      { href: "/learn/no-tracking-privacy", label: "No-tracking privacy" }
    ]
  },
  {
    title: "Handle files safely",
    body: [
      "Chunked encryption keeps large files secure and reliable during upload.",
      "Direct-to-storage uploads keep the API out of the data path in secure mode."
    ],
    links: [
      { href: "/learn/secure-file-sharing", label: "Secure file sharing" },
      { href: "/learn/troubleshooting-downloads", label: "Troubleshooting downloads" }
    ]
  }
];

export default function LearnOverviewPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "The Solun guide to private sharing",
    description: "A pillar guide to privacy-first paste and file sharing.",
    url: "https://solun.pm/learn/overview",
    publisher: { "@type": "Organization", name: "Solun" }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-4xl space-y-8 rounded-3xl border border-ink-700 bg-ink-800/70 p-8 shadow-glow backdrop-blur">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.4em] text-tide-300/70">Solun · Learn</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink-100">The Solun guide to private sharing</h1>
          <p className="text-sm text-ink-200">
            Start here if you want the full picture. This guide links to the most useful deep dives.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          {sections.map((section) => (
            <div key={section.title} className="space-y-3 rounded-2xl border border-ink-700 bg-ink-900/60 p-4">
              <h2 className="text-lg font-semibold text-ink-100">{section.title}</h2>
              <div className="space-y-2 text-sm text-ink-200">
                {section.body.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 pt-2 text-xs uppercase tracking-[0.3em]">
                {section.links.map((link) => (
                  <Link key={link.href} href={link.href} className="text-tide-300 hover:text-tide-200 transition">
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </section>

        <div className="border-t border-ink-700 pt-6 text-xs text-ink-200/70">
          <Link href="/learn" className="text-tide-300 hover:text-tide-200 transition">
            Browse all guides
          </Link>
        </div>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </main>
  );
}
