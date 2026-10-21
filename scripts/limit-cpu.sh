#!/usr/bin/env bash
# Runs a command at low priority and capped at 4 cores, so test runs and releases on the
# shared dev machine leave room for the other game sessions (owner, 2026-10-21).
# Usage: scripts/limit-cpu.sh npm run test:e2e
set -euo pipefail
[[ $# -gt 0 ]] || { echo "usage: $0 <command> [args...]" >&2; exit 2; }
if command -v systemd-run >/dev/null && systemd-run --user --scope --quiet true 2>/dev/null; then
  exec systemd-run --user --scope --quiet -p CPUQuota=400% nice -n 10 "$@"
fi
# No user systemd (CI containers, macOS): low priority only.
exec nice -n 10 "$@"
