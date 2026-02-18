# Solun

**Minimal, secure text sharing.** Share sensitive text with end-to-end encryption or fast encrypted-at-rest quick pastes — all ephemeral by default.

> Solun is available as a hosted service and as open-source software under the [MIT License](./LICENSE).

---

## How it works

| Mode | Encryption | Burn after read |
|------|-----------|----------------|
| **Quick** | AES-256-GCM, server-side key | Always (server-enforced) |
| **Secure** | AES-256-GCM, key never leaves your browser | Optional |

- **Quick pastes** are encrypted at rest and deleted after the first read. The server decrypts on delivery — fast and zero-effort for the sender.
- **Secure pastes** are end-to-end encrypted in the browser before being sent. The decryption key is embedded in the URL fragment and never transmitted to the server.

---

## Self-hosting with Docker

The fastest way to run Solun yourself.

### 1. Clone the repository

```bash
git clone https://github.com/your-org/solun.git
cd solun
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set a strong `ENCRYPTION_SECRET`:

```bash
# Generate a secure secret:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Start

```bash
docker compose up -d
```

The app is available at **http://localhost:3000**.

### Stop

```bash
docker compose down
```

To also remove the database volume:

```bash
docker compose down -v
```

---

## Development setup

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for PostgreSQL)

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

**`apps/api/.env`:**
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/solun
PORT=3001
FRONTEND_URL=http://localhost:3000
ENCRYPTION_SECRET=<random string, min 32 characters>
```

**`apps/web/.env.local`:**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Start PostgreSQL

```bash
docker compose up postgres -d
```

### 4. Set up the database

```bash
pnpm --filter @solun/shared build
pnpm --filter @solun/api exec prisma generate
pnpm --filter @solun/api exec prisma db push
```

### 5. Run in development mode

Open two terminals:

```bash
# Terminal 1
pnpm --filter @solun/api dev

# Terminal 2
pnpm --filter @solun/web dev
```

App runs at **http://localhost:3000**.

---

## Stack

- **Monorepo:** pnpm workspaces + Turbo
- **API:** Node.js · Express · Prisma · PostgreSQL
- **Web:** Next.js 16 · React 19 · Tailwind CSS
- **Encryption:** AES-256-GCM (Web Crypto API for E2E, Node `crypto` for at-rest)

---

## Security notes

- The `ENCRYPTION_SECRET` must stay constant — changing it makes existing quick-paste content permanently unreadable.
- Secure paste keys are only ever stored in the URL fragment (`#key=…`) and never sent to the server.
- Quick pastes are always burn-after-read; there is no way to read them twice.

---

## Releasing

Bump the version across all packages, create a commit and a Git tag, then push:

```bash
# Stable release
pnpm release:patch   # 0.0.1 → 0.0.2
pnpm release:minor   # 0.0.1 → 0.1.0
pnpm release:major   # 0.0.1 → 1.0.0
git push origin main --tags

# Dev pre-release
pnpm release:patch:dev   # 0.0.1 → 0.0.2-dev.1
pnpm release:minor:dev   # 0.0.1 → 0.1.0-dev.1
pnpm release:major:dev   # 0.0.1 → 1.0.0-dev.1
git push origin dev --tags
```

Pushing a tag triggers the publish workflow which builds and pushes the Docker images to GHCR:
- Stable tags → `ghcr.io/solun-pm/solun-api:x.y.z` + `:latest`
- Dev tags → `ghcr.io/solun-pm/solun-api:x.y.z-dev.1` + `:dev`

---

## License

[MIT](./LICENSE)
