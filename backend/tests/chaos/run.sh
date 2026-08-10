#!/usr/bin/env bash
set -euo pipefail

scenario="${1:-help}"
case "$scenario" in
  help)
    sed -n '1,220p' "$(dirname "$0")/README.md"
    ;;
  worker-kill|redis-outage|db-delay|duplicate-request|commit-timeout|crash-after-persist|ws-reconnect|worker-relay-crash)
    echo "Scenario '$scenario' is controlled-chaos documentation only in this repository."
    echo "Run it in an isolated environment using the exact preconditions in README.md."
    ;;
  *) echo "unknown scenario: $scenario" >&2; exit 2;;
esac
