#!/usr/bin/env bash
# ============================================================
# Safety net, independent of run-staging-e2e.sh's own cleanup trap.
#
# Why this exists: when a CI job is cancelled (timeout or manual), GitHub
# sends SIGTERM then escalates to SIGKILL after a short grace period. No
# trap can catch SIGKILL. On this machine's slow disk, `docker compose
# down -v` has sometimes taken longer than that grace period, leaving
# axe-staging-* containers running for hours with nothing left to clean
# them up. This script is meant to run independently via cron, so it
# still works even when the script that started the stack never got to
# clean up at all.
#
# What it does: force-removes any container/network/volume whose name
# starts with "axe-staging-" and has been running longer than
# MAX_AGE_MINUTES. Never touches anything without that exact prefix —
# in particular, never touches the production axe-* containers (no
# "-staging-" in their names).
#
# Install as a cron job (crontab -e):
#   */15 * * * * /path/to/AxeCode_backend/scripts/staging-reaper.sh >> ~/staging-reaper.log 2>&1
# ============================================================
set -uo pipefail

MAX_AGE_MINUTES="${MAX_AGE_MINUTES:-120}"
PREFIX="axe-staging-"

now_epoch=$(date +%s)
max_age_seconds=$((MAX_AGE_MINUTES * 60))
reaped_any=false

for cid in $(docker ps -q --filter "name=${PREFIX}"); do
  name=$(docker inspect --format '{{.Name}}' "$cid" | sed 's#^/##')
  started_at=$(docker inspect --format '{{.State.StartedAt}}' "$cid")
  started_epoch=$(date -d "$started_at" +%s 2>/dev/null || echo "$now_epoch")
  age_seconds=$((now_epoch - started_epoch))

  if [[ "$age_seconds" -gt "$max_age_seconds" ]]; then
    echo "[$(date -u +%FT%TZ)] Reaping ${name} (running $((age_seconds / 60))m, limit ${MAX_AGE_MINUTES}m)"
    docker rm -f "$cid" > /dev/null 2>&1 || true
    reaped_any=true
  fi
done

if [[ "$reaped_any" == true ]]; then
  # Only prune volumes/networks if we actually reaped something this run —
  # keeps the log quiet on the (normal) case where nothing was stuck.
  echo "[$(date -u +%FT%TZ)] Pruning orphaned staging volumes/networks"
  docker volume ls -q --filter "name=axecode-staging_" | xargs -r docker volume rm > /dev/null 2>&1 || true
  docker network ls -q --filter "name=axecode-staging_" | xargs -r docker network rm > /dev/null 2>&1 || true
fi
