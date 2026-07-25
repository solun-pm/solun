FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json turbo.json ./
COPY packages ./packages
COPY apps/web ./apps/web

RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @solun/shared build

# Next.js bakes NEXT_PUBLIC_* into the client bundle at build time. To move the
# build here (instead of running it on every container start) these values have
# to be present as build args. That is safe: they end up in every visitor's
# browser anyway, so they are public by definition.
#
# Changing one of them requires rebuilding the image - restarting with a
# different environment variable has no effect.
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ARG NEXT_PUBLIC_CONNECT_ORIGINS=
ARG NEXT_PUBLIC_R2_ENDPOINT=
ARG NEXT_PUBLIC_R2_PUBLIC_URL=

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_CONNECT_ORIGINS=$NEXT_PUBLIC_CONNECT_ORIGINS \
    NEXT_PUBLIC_R2_ENDPOINT=$NEXT_PUBLIC_R2_ENDPOINT \
    NEXT_PUBLIC_R2_PUBLIC_URL=$NEXT_PUBLIC_R2_PUBLIC_URL

RUN pnpm --filter @solun/web build

CMD ["pnpm", "--filter", "@solun/web", "start"]
