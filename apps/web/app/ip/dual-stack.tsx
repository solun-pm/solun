"use client";

import { useEffect, useState } from "react";
import type { IpInfo, GeoResult } from "../../lib/ip";

interface StackEntry {
  ip: string;
  version: 4 | 6;
  geo: GeoResult | null;
}

interface DualStackState {
  v4: StackEntry | null;
  v6: StackEntry | null;
  v4Loading: boolean;
  v6Loading: boolean;
}

async function fetchStack(url: string): Promise<StackEntry | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      ip: data.ip,
      version: data.version,
      geo: data.city
        ? {
            city: data.city,
            region: data.region,
            country: data.country,
            timezone: data.timezone,
            coordinates: data.coordinates,
          }
        : null,
    };
  } catch {
    return null;
  }
}

function IpCard({
  label,
  entry,
  loading,
}: {
  label: string;
  entry: StackEntry | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <section className="space-y-4 rounded-2xl border border-ink-700 bg-ink-900/60 p-6">
        <h2 className="text-sm uppercase tracking-[0.3em] text-tide-300/80">
          {label}
        </h2>
        <div className="flex items-center gap-3">
          <div className="h-7 w-48 animate-pulse rounded-lg bg-ink-700" />
        </div>
      </section>
    );
  }

  if (!entry) {
    return (
      <section className="space-y-4 rounded-2xl border border-ink-700 bg-ink-900/60 p-6">
        <h2 className="text-sm uppercase tracking-[0.3em] text-tide-300/80">
          {label}
        </h2>
        <p className="text-sm text-ink-400">Nicht verfügbar</p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-ink-700 bg-ink-900/60 p-6">
      <h2 className="text-sm uppercase tracking-[0.3em] text-tide-300/80">
        {label}
      </h2>
      <div className="flex items-center gap-3">
        <span className="break-all font-mono text-2xl font-semibold text-ink-100">
          {entry.ip}
        </span>
        <span className="rounded-full bg-tide-300/15 px-2.5 py-0.5 text-xs font-medium text-tide-300">
          IPv{entry.version}
        </span>
      </div>
      {entry.geo && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {[
            { label: "City", value: entry.geo.city },
            { label: "Region", value: entry.geo.region },
            { label: "Country", value: entry.geo.country },
            { label: "Timezone", value: entry.geo.timezone },
            { label: "Coordinates", value: entry.geo.coordinates },
          ].map((row) => (
            <div key={row.label}>
              <dt className="text-ink-400">{row.label}</dt>
              <dd className="font-medium text-ink-100">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

export default function DualStack({
  serverIp,
}: {
  serverIp: IpInfo;
}) {
  const [state, setState] = useState<DualStackState>(() => {
    // Pre-fill the version we already know from the server render
    const initial: DualStackState = {
      v4: null,
      v6: null,
      v4Loading: true,
      v6Loading: true,
    };
    if (serverIp.version === 4) {
      initial.v4 = { ip: serverIp.ip, version: 4, geo: serverIp.geo };
      initial.v4Loading = false;
    } else {
      initial.v6 = { ip: serverIp.ip, version: 6, geo: serverIp.geo };
      initial.v6Loading = false;
    }
    return initial;
  });

  useEffect(() => {
    // Fetch the missing stack from the dedicated subdomain
    if (serverIp.version === 4) {
      // We already have v4, fetch v6
      fetchStack("https://v6.solun.pm/api/ip").then((entry) =>
        setState((s) => ({ ...s, v6: entry, v6Loading: false })),
      );
    } else {
      // We already have v6, fetch v4
      fetchStack("https://v4.solun.pm/api/ip").then((entry) =>
        setState((s) => ({ ...s, v4: entry, v4Loading: false })),
      );
    }
  }, [serverIp.version]);

  return (
    <div className="space-y-4">
      <IpCard label="IPv4" entry={state.v4} loading={state.v4Loading} />
      <IpCard label="IPv6" entry={state.v6} loading={state.v6Loading} />
    </div>
  );
}
