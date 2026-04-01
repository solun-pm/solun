import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CLI_PATTERN =
  /^(curl|Wget|HTTPie|httpie|fetch|libcurl|python-requests|Go-http-client|PowerShell|aria2)/i;

function applySecurityHeaders(response: NextResponse): void {
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload",
  );
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=()",
  );

  const connectSources = new Set<string>(["'self'"]);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl) {
    try {
      connectSources.add(new URL(apiUrl).origin);
    } catch {
      // ignore
    }
  } else if (process.env.NODE_ENV !== "production") {
    connectSources.add("http://localhost:3001");
  }

  const extraConnect = process.env.NEXT_PUBLIC_CONNECT_ORIGINS;
  if (extraConnect) {
    extraConnect
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
      .forEach((v) => {
        if (v.includes("*")) {
          connectSources.add(v);
          return;
        }
        try {
          connectSources.add(new URL(v).origin);
        } catch {
          connectSources.add(v);
        }
      });
  }

  const r2Endpoint = process.env.NEXT_PUBLIC_R2_ENDPOINT;
  if (r2Endpoint) {
    try {
      connectSources.add(new URL(r2Endpoint).origin);
    } catch {
      // ignore
    }
  }

  const r2Public =
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL ??
    process.env.NEXT_PUBLIC_R2_PUBLIC_ORIGIN;
  if (r2Public) {
    try {
      connectSources.add(new URL(r2Public).origin);
    } catch {
      connectSources.add(r2Public);
    }
  }

  connectSources.add("https://*.r2.cloudflarestorage.com");
  connectSources.add("https://*.eu.r2.cloudflarestorage.com");

  // Allow fetches to v4/v6 subdomains for dual-stack IP detection
  connectSources.add("https://v4.solun.pm");
  connectSources.add("https://v6.solun.pm");

  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    `connect-src ${Array.from(connectSources).join(" ")}`,
    "frame-ancestors 'none'",
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);
}

function getIpFromRequest(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]!.trim();
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function middleware(request: NextRequest) {
  // Return plain-text IP directly for CLI clients hitting /ip
  if (request.nextUrl.pathname === "/ip") {
    const ua = request.headers.get("user-agent") ?? "";
    if (CLI_PATTERN.test(ua)) {
      const ip = getIpFromRequest(request);
      const version = ip.includes(":") ? 6 : 4;
      const body = `${ip}\n`;
      return new NextResponse(body, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-IP-Version": `IPv${version}`,
        },
      });
    }
  }

  const response = NextResponse.next();
  applySecurityHeaders(response);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
