import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CLI_PATTERN =
  /^(curl|Wget|HTTPie|httpie|fetch|libcurl|python-requests|Go-http-client|PowerShell|aria2)/i;

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function applyStaticSecurityHeaders(headers: Headers): void {
  headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload",
  );
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=()",
  );
}

function buildCsp(nonce: string): string {
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

  // In production, lock scripts to a per-request nonce plus 'strict-dynamic'
  // (so nonce'd Next.js bootstrap scripts may load their own chunks) and drop
  // 'unsafe-inline'/'unsafe-eval'. Dev keeps them because Next.js HMR uses eval.
  const isProd = process.env.NODE_ENV === "production";
  const scriptSrc = isProd
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

  const csp = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    `connect-src ${Array.from(connectSources).join(" ")}`,
    "frame-ancestors 'none'",
  ].join("; ");

  return csp;
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

  // Propagate a per-request nonce so server components can stamp inline scripts.
  // Next.js reads the nonce from the CSP on the *request* headers to apply it to
  // its own bootstrap scripts, so the CSP is set on both request and response —
  // and must be finalized on requestHeaders before NextResponse.next().
  const nonce = generateNonce();
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  applyStaticSecurityHeaders(response.headers);
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
