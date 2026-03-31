import { headers } from "next/headers";
import Link from "next/link";
import Script from "next/script";
import geoip from "geoip-lite";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your IP Address",
  description:
    "See your IP address and approximate location. All lookups are local — no data leaves the server.",
  alternates: {
    canonical: "https://solun.pm/ip",
  },
  openGraph: {
    title: "Your IP Address · Solun",
    description:
      "See your IP address and approximate location, looked up entirely server-side.",
    url: "https://solun.pm/ip",
    type: "website" as const,
  },
};

function getIpFromHeaders(headersList: Headers): string {
  const forwarded = headersList.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]!.trim();
  }
  return headersList.get("x-real-ip") ?? "unknown";
}

export default async function IpPage() {
  const headersList = await headers();
  const ip = getIpFromHeaders(headersList);
  const version = ip.includes(":") ? 6 : 4;
  const geo = geoip.lookup(ip);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Your IP Address",
    description:
      "View your IP address and approximate location with a privacy-first lookup.",
    url: "https://solun.pm/ip",
    publisher: { "@type": "Organization", name: "Solun" },
  };

  const locationRows = geo
    ? [
        { label: "City", value: geo.city || "—" },
        { label: "Region", value: geo.region || "—" },
        { label: "Country", value: geo.country || "—" },
        { label: "Timezone", value: geo.timezone || "—" },
        {
          label: "Coordinates",
          value: geo.ll ? `${geo.ll[0]}, ${geo.ll[1]}` : "—",
        },
      ]
    : null;

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
            This is the address your device used to connect. The location is
            looked up from a local database — nothing leaves the server.
          </p>
        </header>

        <section className="space-y-4 rounded-2xl border border-ink-700 bg-ink-900/60 p-6">
          <div className="flex items-center gap-3">
            <span className="font-mono text-2xl font-semibold text-ink-100 break-all">
              {ip}
            </span>
            <span className="rounded-full bg-tide-300/15 px-2.5 py-0.5 text-xs font-medium text-tide-300">
              IPv{version}
            </span>
          </div>
        </section>

        {locationRows ? (
          <section className="space-y-3 rounded-2xl border border-ink-700 bg-ink-900/60 p-6">
            <h2 className="text-sm uppercase tracking-[0.3em] text-tide-300/80">
              Location
            </h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {locationRows.map((row) => (
                <div key={row.label}>
                  <dt className="text-ink-400">{row.label}</dt>
                  <dd className="font-medium text-ink-100">{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : (
          <section className="rounded-2xl border border-ink-700 bg-ink-900/60 p-6">
            <p className="text-sm text-ink-400">
              Location data is not available for this IP address.
            </p>
          </section>
        )}

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
