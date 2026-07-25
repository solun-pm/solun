// Server components must not call the public API hostname: that leaves the
// container, hairpins through the edge proxy and back in, and depends on public
// DNS being resolvable from inside the container. API_INTERNAL_URL points
// straight at the api service (e.g. http://api:3001).
const SERVER_API_URL =
  process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const PROBE_TIMEOUT_MS = 2000;

export type ProbeResult = "exists" | "not-found" | "unknown";

// HEAD probe so a server component can pre-render the right state without
// reading (and thus burning) the resource. Returns "unknown" when the API is
// unreachable, so the client retries from the browser instead of the page
// claiming the content does not exist.
export async function probeResource(path: string): Promise<ProbeResult> {
  try {
    const response = await fetch(`${SERVER_API_URL}${path}`, {
      method: "HEAD",
      cache: "no-store",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
    });
    if (response.ok) return "exists";
    if (response.status === 404) return "not-found";
    return "unknown";
  } catch {
    return "unknown";
  }
}
