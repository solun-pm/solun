#!/usr/bin/env bash
# Local end-to-end check for solun.
#
# Spins up Postgres + MinIO (stand-in for R2) in Docker, runs typecheck + build,
# starts API and web from the build output, exercises the API with curl and the
# UI with Chromium (playwright-core), then tears everything down.
#
# Usage: scripts/e2e-local.sh [--docker]
#   --docker   additionally builds both production Dockerfiles (Node 20) and
#              smoke-tests the resulting images.
#
# Requirements: docker, pnpm, node >= 22, chromium (CHROMIUM=/path to override).
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"

WITH_DOCKER=0
[[ "${1:-}" == "--docker" ]] && WITH_DOCKER=1

PG_PORT=${PG_PORT:-55434}
MINIO_PORT=${MINIO_PORT:-59000}
API_PORT=3001   # baked into the web bundle as NEXT_PUBLIC_API_URL default
WEB_PORT=3000
IMG_API_PORT=3011
IMG_WEB_PORT=3010
WORK=$(mktemp -d /tmp/solun-e2e.XXXXXX)
CHROMIUM=${CHROMIUM:-$(command -v chromium || command -v chromium-browser || true)}
PW_CORE=$(ls -d "$ROOT"/node_modules/.pnpm/playwright-core@*/node_modules/playwright-core 2>/dev/null | head -1 || true)

A="http://127.0.0.1:$API_PORT"
W="http://127.0.0.1:$WEB_PORT"
FAILED=0
PIDS=()

log()  { printf '\n== %s\n' "$*"; }
pass() { echo "PASS $*"; }
fail() { echo "FAIL $*"; FAILED=$((FAILED + 1)); }
expect() { # expect <label> <actual> <expected>
  if [[ "$2" == "$3" ]]; then pass "$1 ($2)"; else fail "$1: got '$2', expected '$3'"; fi
}
json() { node -pe "JSON.parse(require('fs').readFileSync(0,'utf8'))$1"; }

cleanup() {
  set +e
  for p in "${PIDS[@]:-}"; do [[ -n "$p" ]] && kill "$p" 2>/dev/null; done
  docker rm -f solun-e2e-pg solun-e2e-minio solun-e2e-api solun-e2e-web >/dev/null 2>&1
  docker rmi -f solun-e2e-api solun-e2e-web >/dev/null 2>&1
  rm -rf "$WORK"
}
trap cleanup EXIT

[[ -n "$CHROMIUM" ]] || { echo "chromium not found (set CHROMIUM=)"; exit 2; }
[[ -n "$PW_CORE" ]] || { echo "playwright-core not found in node_modules/.pnpm"; exit 2; }
if ss -ltn | grep -qE ":($API_PORT|$WEB_PORT|$PG_PORT|$MINIO_PORT) "; then
  echo "one of the ports $API_PORT/$WEB_PORT/$PG_PORT/$MINIO_PORT is already in use"; exit 2
fi

log "typecheck"
pnpm typecheck
log "build"
NEXT_PUBLIC_API_URL="http://localhost:$API_PORT" pnpm build

log "start postgres + minio"
docker run -d --name solun-e2e-pg -p 127.0.0.1:$PG_PORT:5432 \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=solun postgres:16-alpine >/dev/null
docker run -d --name solun-e2e-minio -p 127.0.0.1:$MINIO_PORT:9000 \
  -e MINIO_ROOT_USER=minioadmin -e MINIO_ROOT_PASSWORD=minioadmin123 minio/minio server /data >/dev/null
for _ in $(seq 1 30); do docker exec solun-e2e-pg pg_isready -U postgres -q && break; sleep 1; done
for _ in $(seq 1 30); do curl -sf "http://127.0.0.1:$MINIO_PORT/minio/health/live" >/dev/null && break; sleep 1; done
docker exec solun-e2e-minio sh -c 'mc alias set local http://localhost:9000 minioadmin minioadmin123 >/dev/null && mc mb -p local/solun' >/dev/null

ENV_FILE="$WORK/api.env"
cat > "$ENV_FILE" <<ENV
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:$PG_PORT/solun
PORT=$API_PORT
FRONTEND_URL=http://localhost:$WEB_PORT
ENCRYPTION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
R2_ENDPOINT=http://127.0.0.1:$MINIO_PORT
R2_ACCESS_KEY_ID=minioadmin
R2_SECRET_ACCESS_KEY=minioadmin123
R2_BUCKET=solun
R2_REGION=us-east-1
NODE_ENV=production
ENV

log "prisma db push"
(cd apps/api && DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:$PG_PORT/solun" pnpm exec prisma db push | tail -1)

log "start api + web"
(set -a; . "$ENV_FILE"; set +a; cd apps/api && exec node dist/index.js) > "$WORK/api.log" 2>&1 &
PIDS+=($!)
(cd apps/web && NODE_ENV=production NEXT_PUBLIC_API_URL="http://localhost:$API_PORT" \
  API_INTERNAL_URL="$A" NEXT_PUBLIC_R2_ENDPOINT="http://127.0.0.1:$MINIO_PORT" \
  exec pnpm exec next start -p $WEB_PORT) > "$WORK/web.log" 2>&1 &
PIDS+=($!)
for _ in $(seq 1 40); do
  curl -sf "$A/health" >/dev/null && curl -sf -o /dev/null "$W/" && break; sleep 1
done
expect "api health" "$(curl -s "$A/health")" '{"ok":true}'
expect "web /" "$(curl -s -o /dev/null -w '%{http_code}' "$W/")" 200

log "api: quick paste"
R=$(curl -s -X POST "$A/api/paste" -H 'content-type: application/json' -d '{"content":"e2e quick","mode":"quick","ttl":3600}')
ID=$(echo "$R" | json .id)
[[ -n "$ID" && "$ID" != "undefined" ]] && pass "create quick paste $ID" || fail "create quick paste: $R"
expect "HEAD exists" "$(curl -s -o /dev/null -w '%{http_code}' -I "$A/api/paste/$ID")" 200
expect "SSR /p/<id>" "$(curl -s -o /dev/null -w '%{http_code}' "$W/p/$ID")" 200
expect "HEAD still exists after SSR (not burned)" "$(curl -s -o /dev/null -w '%{http_code}' -I "$A/api/paste/$ID")" 200
expect "GET content" "$(curl -s "$A/api/paste/$ID" | json .content)" "e2e quick"
expect "GET again burned" "$(curl -s -o /dev/null -w '%{http_code}' "$A/api/paste/$ID")" 404

log "api: secure paste + delete token"
R=$(curl -s -X POST "$A/api/paste" -H 'content-type: application/json' \
  -d '{"content":"Y2lwaGVydGV4dA==","mode":"secure","ttl":null,"iv":"aXZpdml2aXZpdml2","burnAfterRead":false}')
SID=$(echo "$R" | json .id); TOK=$(echo "$R" | json .deleteToken)
expect "GET secure (1)" "$(curl -s -o /dev/null -w '%{http_code}' "$A/api/paste/$SID")" 200
expect "GET secure (2, no burn)" "$(curl -s -o /dev/null -w '%{http_code}' "$A/api/paste/$SID")" 200
expect "SSR /s/<id>" "$(curl -s -o /dev/null -w '%{http_code}' "$W/s/$SID")" 200
expect "DELETE wrong token" "$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$A/api/paste/$SID" -H 'x-delete-token: nope')" 403
expect "DELETE right token" "$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$A/api/paste/$SID" -H "x-delete-token: $TOK")" 204
expect "GET after delete" "$(curl -s -o /dev/null -w '%{http_code}' "$A/api/paste/$SID")" 404

log "api: quick file upload + presigned download"
head -c 300000 /dev/urandom > "$WORK/upload.bin"
R=$(curl -s -X POST "$A/api/files/quick" -F "expiresIn=1h" -F "file=@$WORK/upload.bin;type=application/octet-stream")
FID=$(echo "$R" | json .id)
[[ -n "$FID" && "$FID" != "undefined" ]] && pass "upload quick file $FID" || fail "upload quick file: $R"
expect "HEAD file" "$(curl -s -o /dev/null -w '%{http_code}' -I "$A/api/files/$FID")" 200
R=$(curl -s "$A/api/files/$FID")
expect "file sizeBytes" "$(echo "$R" | json .sizeBytes)" 300000
expect "presigned download" "$(curl -s -o /dev/null -w '%{http_code}' "$(echo "$R" | json .downloadUrl)")" 200
expect "SSR /f/<id>" "$(curl -s -o /dev/null -w '%{http_code}' "$W/f/$FID")" 200

log "pages"
for p in / /learn /roadmap /ip /learn/overview /robots.txt /sitemap.xml /p/doesnotexist; do
  expect "GET $p" "$(curl -s -o /dev/null -w '%{http_code}' "$W$p")" 200
done
expect "GET /files (redirect)" "$(curl -s -o /dev/null -w '%{http_code}' "$W/files")" 307
CSP=$(curl -sI "$W/p/$ID" | grep -i '^content-security-policy' || true)
[[ "$CSP" == *"nonce-"* && "$CSP" == *"strict-dynamic"* ]] && pass "CSP nonce + strict-dynamic" || fail "CSP header: $CSP"

log "browser (chromium)"
head -c 100000 /dev/urandom > "$WORK/browser.bin"
BFID=$(curl -s -X POST "$A/api/files/quick" -F "expiresIn=1h" -F "file=@$WORK/browser.bin;type=application/octet-stream" | json .id)
if WEB_URL="http://localhost:$WEB_PORT" FILE_ID="$BFID" ORIGINAL_FILE="$WORK/browser.bin" PW_CORE="$PW_CORE" CHROMIUM="$CHROMIUM" \
   node scripts/e2e-browser.mjs; then pass "browser suite"; else fail "browser suite"; fi

if grep -iE "error" "$WORK/api.log" | grep -v "Not found" >/dev/null; then
  fail "api log contains errors:"; grep -iE "error" "$WORK/api.log" | head -5
else
  pass "api log clean"
fi

if [[ $WITH_DOCKER -eq 1 ]]; then
  log "docker: build production images (Node 20)"
  docker build -q -f apps/api/Dockerfile -t solun-e2e-api . >/dev/null && pass "build api image" || fail "build api image"
  docker build -q -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL="http://localhost:$IMG_API_PORT" -t solun-e2e-web . >/dev/null \
    && pass "build web image" || fail "build web image"
  log "docker: smoke test images"
  docker run -d --name solun-e2e-api --network host --env-file "$ENV_FILE" -e PORT=$IMG_API_PORT solun-e2e-api >/dev/null
  docker run -d --name solun-e2e-web --network host -e PORT=$IMG_WEB_PORT -e API_INTERNAL_URL="http://127.0.0.1:$IMG_API_PORT" solun-e2e-web >/dev/null
  for _ in $(seq 1 60); do
    curl -sf "http://127.0.0.1:$IMG_API_PORT/health" >/dev/null && curl -sf -o /dev/null "http://127.0.0.1:$IMG_WEB_PORT/" && break; sleep 2
  done
  expect "image api health" "$(curl -s "http://127.0.0.1:$IMG_API_PORT/health")" '{"ok":true}'
  R=$(curl -s -X POST "http://127.0.0.1:$IMG_API_PORT/api/paste" -H 'content-type: application/json' -d '{"content":"image smoke","mode":"quick","ttl":3600}')
  IID=$(echo "$R" | json .id)
  expect "image web SSR /p/<id>" "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$IMG_WEB_PORT/p/$IID")" 200
  expect "image api read" "$(curl -s "http://127.0.0.1:$IMG_API_PORT/api/paste/$IID" | json .content)" "image smoke"
  echo "api image node: $(docker exec solun-e2e-api node -v)"
fi

log "result"
if [[ $FAILED -eq 0 ]]; then
  echo "ALL CHECKS PASSED"
else
  echo "$FAILED CHECK(S) FAILED"
  echo "--- api.log tail"; tail -20 "$WORK/api.log"
  echo "--- web.log tail"; tail -20 "$WORK/web.log"
  exit 1
fi
