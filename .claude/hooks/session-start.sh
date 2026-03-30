#!/bin/bash
set -euo pipefail

# Only run in remote (web) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Install pnpm if not available
if ! command -v pnpm &>/dev/null; then
  npm install -g pnpm@9.15.5
fi

# Install dependencies (idempotent, uses cache)
pnpm install

# Generate Prisma client for API typecheck/build
pnpm --filter @solun/api exec prisma generate --schema=prisma/schema.prisma
