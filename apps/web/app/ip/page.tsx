import { headers } from "next/headers";
import Link from "next/link";
import Script from "next/script";
import geoip from "geoip-lite";
import { getIpFromHeaders, getIpVersion, extractGeo } from "../../lib/ip";
import DualStack from "./dual-stack";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your IP Address",
  description:
    "See your IPv4 and IPv6 addresses and approximate location. All lookups are local — no data leaves the server.",
  alternates: {
    canonical: "https://solun.pm/ip",
  },
  openGraph: {
    title: "Your IP Address · Solun",
    description:
      "See your IPv4 and IPv6 addresses, looked up entirely server-side.",
    url: "https://solun.pm/ip",
    type: "website" as const,
  },
};

export default async function IpPage() {
  const headersList = await headers();
  const ip = getIpFromHeaders(headersList);
  const version = getIpVersion(ip);
  const geo = extractGeo(geoip.lookup(ip));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Your IP Address",
    description:
      "View your IPv4 and IPv6 addresses with a privacy-first lookup.",
    url: "https://solun.pm/ip",
    publisher: { "@type": "Organization", name: "Solun" },
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl space-y-8 rounded-3xl border border-ink-700 bg-ink-800/70 p-8 shadow-glow backdrop-blur">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.4em] text-tide-300/70">
            Solun · IP Lookup
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink-100">
            Your IP Address
          </h1>
          <p className="text-sm text-ink-200">
            These are the addresses your device used to connect. All lookups
            are local — nothing leaves the server.
          </p>
        </header>

        <DualStack serverIp={{ ip, version, geo }} />

        <section className="space-y-4 rounded-2xl border border-ink-700 bg-ink-900/60 p-6">
          <h2 className="text-sm uppercase tracking-[0.3em] text-tide-300/80">
            Terminal
          </h2>
          <p className="text-sm text-ink-200">
            You can also check your IP from the command line:
          </p>
          <pre className="rounded-xl bg-ink-950 px-4 py-3 font-mono text-sm text-tide-300 select-all">
curl https://solun.pm/ip
          </pre>
        </section>

        <section className="space-y-3 border-t border-ink-700 pt-6 text-sm text-ink-200">
          <Link
            href="/"
            className="text-tide-300 transition hover:text-tide-200"
          >
            Back to Solun
          </Link>
          <div className="flex flex-wrap items-center gap-4 text-xs uppercase tracking-[0.3em]">
            <Link
              href="/learn"
              className="text-tide-300 transition hover:text-tide-200"
            >
              Learn
            </Link>
            <Link
              href="/roadmap"
              className="text-tide-300 transition hover:text-tide-200"
            >
              Roadmap
            </Link>
            <a
              href="https://github.com/solun-pm/solun"
              className="text-tide-300 transition hover:text-tide-200"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </div>
        </section>
      </div>
      <Script id="ip-jsonld" type="application/ld+json">
        {JSON.stringify(jsonLd)}
      </Script>
    </main>
  );
}
