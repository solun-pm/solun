FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y openssl \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json turbo.json ./
COPY packages ./packages
COPY apps/api ./apps/api

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @solun/shared build
RUN pnpm --filter @solun/api exec prisma generate
RUN pnpm --filter @solun/api build

# Run db push (idempotent schema sync) before starting the server
CMD ["sh", "-c", "pnpm --filter @solun/api exec prisma db push --skip-generate && pnpm --filter @solun/api start"]
