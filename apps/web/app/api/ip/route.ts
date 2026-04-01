import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import geoip from "geoip-lite";
import {
  getIpFromHeaders,
  getIpVersion,
  extractGeo,
  formatPlainText,
} from "../../../lib/ip";

export const dynamic = "force-dynamic";

const CLI_PATTERN =
  /^(curl|Wget|HTTPie|httpie|fetch|libcurl|python-requests|Go-http-client|PowerShell|aria2)/i;

function corsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  if (/^https?:\/\/([a-z0-9-]+\.)*solun\.pm(:\d+)?$/.test(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
  }
  return {};
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request),
  });
}

export async function GET(request: NextRequest) {
  const headersList = await headers();
  const ip = getIpFromHeaders(headersList);
  const version = getIpVersion(ip);
  const geo = extractGeo(geoip.lookup(ip));

  const ua = headersList.get("user-agent") ?? "";
  const wantsText =
    CLI_PATTERN.test(ua) ||
    request.nextUrl.searchParams.get("format") === "text";

  const cors = corsHeaders(request);

  if (wantsText) {
    return new NextResponse(formatPlainText(ip, version, geo), {
      headers: { "Content-Type": "text/plain; charset=utf-8", ...cors },
    });
  }

  return NextResponse.json(
    { ip, version, ...(geo ?? {}) },
    { headers: cors },
  );
}
