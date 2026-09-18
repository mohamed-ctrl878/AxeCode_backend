#!/usr/bin/env bash
# ============================================================
# Runs the full staging E2E cycle on the self-hosted runner:
#   up -> wait for health -> run Playwright E2E (frontend repo)
#   -> cleanup (ALWAYS, success or failure)
#
# Assumes:
#   - .env.staging already exists in this directory (written by the
#     staging-e2e workflow from GitHub Environment secrets, or by hand
#     for a manual local run — see .env.staging.example).
#   - $FRONTEND_DIR points at a checkout of the AxeCode (frontend) repo.
#
# Exit code is the Playwright exit code — the caller (CI or you) decides
# what to do with pass/fail. Cleanup happens either way.
# ============================================================
set -uo pipefail

COMPOSE="docker compose -p axecode-staging -f docker-compose.staging.yml"
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
# Runs on normal exit AND on error/interrupt — this is the whole point:
# nothing is left running on this machine no matter how the run ends.
trap cleanup EXIT

if [[ ! -f .env.staging ]]; then
  echo "ERROR: .env.staging not found. Copy .env.staging.example and fill it in," \
       "or let the staging-e2e workflow generate it from secrets." >&2
  exit 1
fi

echo "── Starting staging stack ──"
$COMPOSE up -d --build

echo "── Waiting for Strapi health check (up to 3 minutes) ──"
for i in $(seq 1 36); do
  if curl -sf "${STAGING_BACKEND_URL}/_health" > /dev/null 2>&1; then
    echo "Backend is healthy."
    break
  fi
  if [[ "$i" -eq 36 ]]; then
    echo "ERROR: backend did not become healthy in time." >&2
    $COMPOSE logs strapi --tail=100 || true
    EXIT_CODE=1
    exit "$EXIT_CODE"
  fi
  sleep 5
done

echo "── Building and serving the frontend against the staging backend ──"
pushd "$FRONTEND_DIR" > /dev/null
npm ci --legacy-peer-deps
VITE_API_BASE_URL="${STAGING_BACKEND_URL}" \
  VITE_RECAPTCHA_SITE_KEY="6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI" \
  npm run build
npm run preview -- --port "$FRONTEND_PORT" --strictPort &
FRONTEND_PID=$!
popd > /dev/null

echo "── Waiting for frontend to serve (up to 1 minute) ──"
for i in $(seq 1 12); do
  if curl -sf "http://localhost:${FRONTEND_PORT}" > /dev/null 2>&1; then
    echo "Frontend is serving."
    break
  fi
  if [[ "$i" -eq 12 ]]; then
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
  E2E_TEST_USER_EMAIL="${E2E_TEST_USER_EMAIL:?E2E_TEST_USER_EMAIL is required}" \
  E2E_TEST_USER_PASSWORD="${E2E_TEST_USER_PASSWORD:?E2E_TEST_USER_PASSWORD is required}" \
  CI=true \
  npm run test:e2e
EXIT_CODE=$?
popd > /dev/null

exit "$EXIT_CODE"
# `trap cleanup EXIT` fires here regardless of $EXIT_CODE.
