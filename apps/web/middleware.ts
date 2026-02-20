import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Security headers middleware for Solun
 * Implements critical security headers for a privacy-focused application
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Strict-Transport-Security (HSTS)
  // Forces HTTPS for 1 year, includes all subdomains, eligible for browser preload list
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );

  // X-Frame-Options
  // Prevents clickjacking by disabling iframe embedding entirely
  response.headers.set("X-Frame-Options", "DENY");

  // X-Content-Type-Options
  // Prevents MIME type sniffing attacks
  response.headers.set("X-Content-Type-Options", "nosniff");

  // Referrer-Policy
  // Controls referrer information sent to other sites
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions-Policy
  // Disables unnecessary browser features
  response.headers.set(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=()"
  );

  // Content-Security-Policy
  // Note: Next.js requires 'unsafe-inline' and 'unsafe-eval' for development
  // Consider tightening this in production with nonces
  const connectSources = new Set<string>(["'self'"]);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl) {
    try {
      connectSources.add(new URL(apiUrl).origin);
    } catch {
      // Ignore invalid API URL to avoid breaking CSP generation
    }
  } else if (process.env.NODE_ENV !== "production") {
    connectSources.add("http://localhost:3001");
  }

  const extraConnect = process.env.NEXT_PUBLIC_CONNECT_ORIGINS;
  if (extraConnect) {
    extraConnect
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((value) => {
        if (value.includes("*")) {
          connectSources.add(value);
          return;
        }
        try {
          connectSources.add(new URL(value).origin);
        } catch {
          connectSources.add(value);
        }
      });
  }

  const r2Endpoint = process.env.NEXT_PUBLIC_R2_ENDPOINT;
  if (r2Endpoint) {
    try {
      connectSources.add(new URL(r2Endpoint).origin);
    } catch {
      // ignore malformed value
    }
  }

  const r2Public = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? process.env.NEXT_PUBLIC_R2_PUBLIC_ORIGIN;
  if (r2Public) {
    try {
      connectSources.add(new URL(r2Public).origin);
    } catch {
      connectSources.add(r2Public);
    }
  }

  // Allow Cloudflare R2 endpoints for metadata/file fetches.
  connectSources.add("https://*.r2.cloudflarestorage.com");
  connectSources.add("https://*.eu.r2.cloudflarestorage.com");

  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    `connect-src ${Array.from(connectSources).join(" ")}`,
    "frame-ancestors 'none'"
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);

  return response;
}

// Apply middleware to all routes
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)"
  ]
};
