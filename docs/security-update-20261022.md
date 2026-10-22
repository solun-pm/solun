# Security release 1.3.16

Next.js 16.4.2, React/React DOM 19.2.9, Node 22 LTS in both production images. Compatible dependency patches include proxy-addr, IP parsing and Prisma 7.10.1; schema and public interfaces are unchanged.

Full and production pnpm dependency audits report zero findings. Typecheck, production builds and the existing complete API/browser E2E suite pass with isolated PostgreSQL and S3-compatible fixtures: quick/secure paste, burn after read, repeat reads, delete authorization, file upload/download SHA-256, CSP, and browser checks without errors. Both production Docker images build and pass API-health/SSR/content smoke checks on Node 22.23.4. No production user content was used.

References: https://nextjs.org/blog/nextjs-security-update-october-14-2026 and https://nodejs.org/en/about/previous-releases.
