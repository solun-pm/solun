# Self-hosted usage analytics

Page views and SPA navigation use https://rybbit.scpx.de. The site ID is public configuration, never an API credential. Existing optional Cozycall configuration remains supported.

New site settings disable URL parameters, raw IP storage, outbound events, replay, form and copy tracking. Visitor identifiers rotate daily. Secret-bearing API/auth routes and application-specific order/share paths are excluded; selected object paths are masked before transport. No signed-in account identifiers or content are supplied to the tracker.

Next Script loads once after hydration. Solun preserves nonce-based CSP and excludes /p, /s and /f share routes; the license portal permits only the existing self-hosted analytics origin in script/connect policies. No schema, authentication or payment behavior changes.

Validation: TypeScript and secret scan; existing dependency audit findings are limited to development tooling and recorded privately. CI builds and live browser tracking checks accompany deployment. Script options were checked against installed Rybbit source and https://rybbit.com/docs/script.
