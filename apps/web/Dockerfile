FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json turbo.json ./
COPY packages ./packages
COPY apps/web ./apps/web

RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @solun/shared build

# next build runs at container start so NEXT_PUBLIC_* env vars are available
CMD ["sh", "-c", "pnpm --filter @solun/web build && pnpm --filter @solun/web start"]
