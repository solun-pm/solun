import type { Lookup } from "geoip-lite";

function normalizeIp(ip: string): string {
  // Node can represent an IPv4 socket as ::ffff:192.0.2.1. It is still IPv4.
  return ip.trim().replace(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i, "$1");
}

export function getIpFromHeaders(headersList: Headers): string {
  const forwarded = headersList.get("x-forwarded-for");
  if (forwarded) {
    return normalizeIp(forwarded.split(",")[0]!);
  }
  return normalizeIp(headersList.get("x-real-ip") ?? "unknown");
}

export function getIpVersion(ip: string): 4 | 6 {
  return normalizeIp(ip).includes(":") ? 6 : 4;
}

export interface GeoResult {
  city: string;
  region: string;
  country: string;
  timezone: string;
  coordinates: string;
}

export function extractGeo(geo: Lookup | null): GeoResult | null {
  if (!geo) return null;
  return {
    city: geo.city || "—",
    region: geo.region || "—",
    country: geo.country || "—",
    timezone: geo.timezone || "—",
    coordinates: geo.ll ? `${geo.ll[0]}, ${geo.ll[1]}` : "—",
  };
}

export function formatPlainText(
  ip: string,
  version: 4 | 6,
  geo: GeoResult | null,
): string {
  const lines = [
    `IP:          ${ip}`,
    `Version:     IPv${version}`,
  ];
  if (geo) {
    lines.push(
      `City:        ${geo.city}`,
      `Region:      ${geo.region}`,
      `Country:     ${geo.country}`,
      `Timezone:    ${geo.timezone}`,
      `Coordinates: ${geo.coordinates}`,
    );
  }
  return lines.join("\n") + "\n";
}

export interface IpInfo {
  ip: string;
  version: 4 | 6;
  geo: GeoResult | null;
}
