#!/usr/bin/env bash
# ============================================================
# Runs the full staging E2E cycle on the self-hosted runner:
#   up -> wait for health -> seed test user -> run Playwright E2E
#   (frontend repo) -> cleanup (ALWAYS, success or failure)
#
# Assumes:
#   - .env.staging already exists in this directory (written by the
#     staging-e2e workflow from GitHub Environment secrets, or by hand
#     for a manual local run — see .env.staging.example).
#   - $FRONTEND_DIR points at a checkout of the AxeCode (frontend) repo.
#   - The axecode-staging-strapi image is ALREADY built (see "Rebuilding
#     the image" below). This script deliberately does NOT build it.
#
# Exit code is the Playwright exit code — the caller (CI or you) decides
# what to do with pass/fail. Cleanup happens either way.
#
# ── Rebuilding the image ──
# On this machine's disk, `RUN chown -R node:node /app` in the production
# stage can take 15-40+ minutes (thousands of small files, slow I/O) —
# and ANY change to the repo (even an unrelated file like this script)
# invalidates Docker's cache from `COPY . .` onward, forcing that same
# slow chown to re-run. That's too slow and unpredictable to happen
# inside a timed CI run, so it never does here — `up` below reuses
# whatever image already exists. Rebuild manually, at your own pace,
# whenever backend code actually changes:
#
#   tmux new -s docker-build
#   cd ~/actions-runner-staging/_work_staging/AxeCode_backend/AxeCode_backend/AxeCode_backend
#   docker compose -p axecode-staging -f docker-compose.staging.yml --env-file .env.staging.example build
#   # Ctrl+B then D to detach; `tmux attach -t docker-build` to check back.
#
# ── If this script is killed hard (SIGKILL) before cleanup runs ──
# No trap can catch SIGKILL. See scripts/staging-reaper.sh, installed as
# a cron job on this machine, which force-removes any axe-staging-*
# container/network/volume left running past a safety age — independent
# of this script, so it still works even if this file's own cleanup
# never gets to run at all.
# ============================================================
set -uo pipefail

# --env-file is required: Docker Compose only auto-loads a file literally
# named `.env` in the working directory. Without this flag, variable
# substitutions in docker-compose.staging.yml (like ${DATABASE_PASSWORD})
# silently resolve to an empty string instead of reading .env.staging —
# which made Postgres refuse to start (the official image rejects an
# empty superuser password) while docker compose only printed a warning,
# not an error, making this easy to miss.
COMPOSE="docker compose -p axecode-staging -f docker-compose.staging.yml --env-file .env.staging"
FRONTEND_DIR="${FRONTEND_DIR:-../AxeCode}"
STAGING_BACKEND_URL="http://localhost:12338"
FRONTEND_PORT=4173
FRONTEND_PID=""
EXIT_CODE=0

cleanup() {
  echo "── Cleaning up staging stack (always runs, exit code so far: ${EXIT_CODE}) ──"
  if [[ -n "$FRONTEND_PID" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
  $COMPOSE down -v --remove-orphans || true
  rm -f .env.staging
  echo "── Cleanup done ──"
}
# EXIT covers normal return and `exit` calls. SIGTERM/SIGINT are caught
# explicitly too (not just implied by EXIT) so a cancelled CI job or a
# Ctrl+C starts cleanup immediately rather than however bash would
# otherwise handle that signal — every second here matters when the
# thing being cleaned up is a stack sharing this machine with production.
# This still can't catch SIGKILL (e.g. if GitHub's SIGTERM grace period
# elapses first on a slow run) — that gap is what staging-reaper.sh
# (a cron job, independent of this script) exists to close.
trap cleanup EXIT
trap 'exit 143' TERM   # 128+15, conventional SIGTERM exit code; triggers the EXIT trap above
trap 'exit 130' INT    # 128+2, conventional SIGINT exit code

if [[ ! -f .env.staging ]]; then
  echo "ERROR: .env.staging not found. Copy .env.staging.example and fill it in," \
       "or let the staging-e2e workflow generate it from secrets." >&2
  exit 1
fi

if ! docker image inspect axecode-staging-strapi:latest > /dev/null 2>&1; then
  echo "ERROR: image 'axecode-staging-strapi:latest' does not exist yet." >&2
  echo "Build it manually first (see the comment block at the top of this" \
       "script) — this script intentionally never builds it itself, since" \
       "a build on this machine's disk can take 15-40+ minutes." >&2
  EXIT_CODE=1
  exit "$EXIT_CODE"
fi

echo "── Starting staging stack (reusing existing image, no build) ──"
$COMPOSE up -d

# On this machine, Strapi's own boot (DB migrations + several sequential
# permission/seed checks in bootstrap(), re-run on every start even when
# they end up no-ops) has taken up to ~3m10s end to end — right past the
# old 3-minute window here, which made the health check give up mere
# seconds before Strapi actually finished. 8 minutes gives real margin
# without hiding a genuine hang.
echo "── Waiting for Strapi health check (up to 8 minutes) ──"
for i in $(seq 1 96); do
  if curl -sf "${STAGING_BACKEND_URL}/_health" > /dev/null 2>&1; then
    echo "Backend is healthy."
    break
  fi
  if [[ "$i" -eq 96 ]]; then
    echo "ERROR: backend did not become healthy in time." >&2
    $COMPOSE logs strapi --tail=100 || true
    EXIT_CODE=1
    exit "$EXIT_CODE"
  fi
  sleep 5
done

# ── Seed test user for E2E ──
# The staging stack uses a fresh database every run (volumes are destroyed
# in cleanup). Strapi's bootstrap seeds permissions, wallets, and tags but
# NOT user accounts. Without this step, Playwright's login tests fail
# because the test user simply doesn't exist.
#
# We register the user through Strapi's own REST API (the same endpoint
# the real frontend uses), then confirm them directly in Postgres so
# login works without needing to handle OTP email verification.
echo "── Seeding E2E test user ──"
E2E_EMAIL="${E2E_TEST_USER_EMAIL:?E2E_TEST_USER_EMAIL is required}"
E2E_PASSWORD="${E2E_TEST_USER_PASSWORD:?E2E_TEST_USER_PASSWORD is required}"
# Derive a username from the email (everything before @)
E2E_USERNAME=$(echo "$E2E_EMAIL" | cut -d'@' -f1 | tr '[:upper:]' '[:lower:]')

# Step 1: Register the user via Strapi API
REGISTER_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${STAGING_BACKEND_URL}/api/auth/local/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${E2E_USERNAME}\",\"email\":\"${E2E_EMAIL}\",\"password\":\"${E2E_PASSWORD}\",\"firstname\":\"E2E\",\"lastname\":\"TestUser\",\"recaptchaToken\":\"test-bypass\"}")
REGISTER_HTTP_CODE=$(echo "$REGISTER_RESPONSE" | tail -n1)
REGISTER_BODY=$(echo "$REGISTER_RESPONSE" | sed '$d')
echo "Register response (HTTP ${REGISTER_HTTP_CODE}): ${REGISTER_BODY}"

# Step 2: Confirm the user directly in Postgres so login works
# (The register endpoint sets confirmed=false and sends an OTP email,
# but in CI there's no mailbox to receive it.)
DB_CONTAINER=$($COMPOSE ps -q db)
if [[ -n "$DB_CONTAINER" ]]; then
  docker exec "$DB_CONTAINER" psql -U axecode_staging -d axecode_staging \
    -c "UPDATE public.up_users SET confirmed = true WHERE email = '${E2E_EMAIL}';" \
    2>/dev/null && echo "Test user confirmed in DB." || echo "WARN: Could not confirm user in DB (may already be confirmed)."
else
  echo "WARN: Could not find DB container to confirm test user."
fi

# Verify login actually works before wasting time on Playwright
LOGIN_CHECK=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${STAGING_BACKEND_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"identifier\":\"${E2E_EMAIL}\",\"password\":\"${E2E_PASSWORD}\",\"recaptchaToken\":\"test-bypass\"}")
echo "Login verification: HTTP ${LOGIN_CHECK}"
if [[ "$LOGIN_CHECK" != "200" ]]; then
  echo "WARN: Login returned HTTP ${LOGIN_CHECK} — tests may fail. Strapi logs:" >&2
  $COMPOSE logs strapi --tail=30 || true
fi

echo "── Building and serving the frontend against the staging backend ──"
pushd "$FRONTEND_DIR" > /dev/null
# The AxeCode frontend's own CI (.github/workflows/pipeline.yml) doesn't
# use `npm ci` either, for the same reason we hit here: package-lock.json
# has drifted out of sync with package.json (most recently missing the
# @playwright/test entries added for E2E). Match their own established
# approach instead of fighting it: regenerate the lockfile fresh rather
# than requiring it to already match exactly.
rm -f package-lock.json
npm install --legacy-peer-deps
VITE_API_BASE_URL="${STAGING_BACKEND_URL}" \
  VITE_RECAPTCHA_SITE_KEY="6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI" \
  VITE_RECAPATCH="6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI" \
  npm run build
npm run preview -- --port "$FRONTEND_PORT" --strictPort &
FRONTEND_PID=$!
popd > /dev/null

echo "── Waiting for frontend to serve (up to 2 minutes) ──"
for i in $(seq 1 24); do
  if curl -sf "http://localhost:${FRONTEND_PORT}" > /dev/null 2>&1; then
    echo "Frontend is serving."
    break
  fi
  if [[ "$i" -eq 24 ]]; then
    echo "ERROR: frontend did not start serving in time." >&2
    EXIT_CODE=1
    exit "$EXIT_CODE"
  fi
  sleep 5
done

echo "── Running Playwright E2E ──"
pushd "$FRONTEND_DIR" > /dev/null
npx playwright install --with-deps chromium

E2E_BASE_URL="http://localhost:${FRONTEND_PORT}" \
  E2E_TEST_USER_EMAIL="${E2E_EMAIL}" \
  E2E_TEST_USER_PASSWORD="${E2E_PASSWORD}" \
  CI=true \
  npm run test:e2e
EXIT_CODE=$?
popd > /dev/null

exit "$EXIT_CODE"
# `trap cleanup EXIT` fires here regardless of $EXIT_CODE.
