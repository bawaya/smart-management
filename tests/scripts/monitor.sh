#!/usr/bin/env bash
# Production monitor — run from WSL or any Linux/macOS shell.
#
# Usage:
#   ./scripts/monitor.sh live              # real-time stream of every request
#   ./scripts/monitor.sh live errors       # real-time stream, errors only
#   ./scripts/monitor.sh recent            # last 30 requests from D1
#   ./scripts/monitor.sh recent 100        # last 100 requests
#   ./scripts/monitor.sh attackers         # IPs with many failed auth attempts
#   ./scripts/monitor.sh users             # activity per authenticated user
#   ./scripts/monitor.sh countries         # traffic breakdown by country
#   ./scripts/monitor.sh slow              # middleware calls > 50ms
#   ./scripts/monitor.sh summary           # everything at a glance
#   ./scripts/monitor.sh watch             # refresh summary every 5 seconds
#
# Assumes wrangler is authenticated and you're running from tests/.

set -euo pipefail

PROJECT="smart-management"
DB="smart-management"
MODE="${1:-summary}"
ARG="${2:-}"

# Run wrangler from the project root so it picks up wrangler.toml bindings.
cd "$(dirname "$0")/../.." || exit 1

# ---------------- Helpers ----------------

q() {
  # Execute a SQL query on remote D1 and print the JSON results array.
  npx wrangler d1 execute "$DB" --remote --json --command="$1" 2>/dev/null \
    | python3 -c 'import json,sys; print(json.dumps(json.load(sys.stdin)[0].get("results",[]),indent=2,ensure_ascii=False))'
}

table_query() {
  # Execute a query and print results as a simple ASCII table.
  local sql="$1"
  npx wrangler d1 execute "$DB" --remote --json --command="$sql" 2>/dev/null \
    | python3 -c '
import json, sys
rows = json.load(sys.stdin)[0].get("results", [])
if not rows:
    print("  (no rows)")
    sys.exit(0)
keys = list(rows[0].keys())
widths = {k: max(len(str(k)), *(len(str(r.get(k, ""))) for r in rows)) for k in keys}
print("  " + " │ ".join(k.ljust(widths[k]) for k in keys))
print("  " + "─┼─".join("─" * widths[k] for k in keys))
for r in rows:
    print("  " + " │ ".join(str(r.get(k, "")).ljust(widths[k]) for k in keys))
'
}

latest_deployment() {
  npx wrangler pages deployment list --project-name="$PROJECT" 2>&1 \
    | grep Production | head -1 \
    | awk -F'│' '{gsub(/ /,"",$2); print $2}'
}

# ---------------- Modes ----------------

case "$MODE" in

  live)
    DEP=$(latest_deployment)
    echo "▶ Live tail — deployment $DEP (Ctrl+C to stop)"
    if [ "$ARG" = "errors" ]; then
      npx wrangler pages deployment tail "$DEP" \
        --project-name="$PROJECT" --format=pretty --status=error
    else
      npx wrangler pages deployment tail "$DEP" \
        --project-name="$PROJECT" --format=pretty
    fi
    ;;

  recent)
    N="${ARG:-30}"
    echo "▶ Last $N requests:"
    table_query "SELECT substr(timestamp, 12, 8) as time, method, outcome, duration_ms as ms, cf_country as cc, substr(url, instr(url, '.dev')+4, 60) as path FROM request_log ORDER BY timestamp DESC LIMIT $N"
    ;;

  attackers)
    echo "▶ Top IPs by failed auth attempts (last 24h):"
    table_query "SELECT ip, cf_country as country, COUNT(*) as attempts, MAX(substr(timestamp, 12, 8)) as last_try FROM request_log WHERE outcome = 'auth_redirect' AND timestamp > datetime('now', '-1 day') GROUP BY ip ORDER BY attempts DESC LIMIT 20"
    ;;

  users)
    echo "▶ Activity per authenticated user (last 24h):"
    table_query "SELECT u.username, COUNT(rl.id) as requests, MAX(substr(rl.timestamp, 12, 8)) as last_seen FROM request_log rl JOIN users u ON u.id = rl.user_id WHERE rl.timestamp > datetime('now', '-1 day') AND rl.outcome = 'auth_ok' GROUP BY rl.user_id ORDER BY requests DESC"
    ;;

  countries)
    echo "▶ Traffic by country (all time):"
    table_query "SELECT cf_country as country, COUNT(*) as hits, SUM(CASE WHEN outcome='auth_ok' THEN 1 ELSE 0 END) as logged_in, SUM(CASE WHEN outcome='auth_redirect' THEN 1 ELSE 0 END) as anonymous FROM request_log GROUP BY cf_country ORDER BY hits DESC"
    ;;

  slow)
    echo "▶ Middleware calls > 50ms (last 24h):"
    table_query "SELECT substr(timestamp, 12, 8) as time, duration_ms as ms, method, outcome, substr(url, instr(url, '.dev')+4, 60) as path FROM request_log WHERE duration_ms > 50 AND timestamp > datetime('now', '-1 day') ORDER BY duration_ms DESC LIMIT 20"
    ;;

  summary)
    echo "▶ Last 24h summary:"
    table_query "SELECT outcome, COUNT(*) as n, SUM(CASE WHEN user_id IS NOT NULL THEN 1 ELSE 0 END) as auth_rows, AVG(duration_ms) as avg_ms FROM request_log WHERE timestamp > datetime('now', '-1 day') GROUP BY outcome ORDER BY n DESC"
    echo
    echo "▶ Last 5 requests:"
    table_query "SELECT substr(timestamp, 12, 8) as time, method, outcome, cf_country as cc, substr(url, instr(url, '.dev')+4, 50) as path FROM request_log ORDER BY timestamp DESC LIMIT 5"
    ;;

  watch)
    echo "▶ Auto-refresh summary every 5s (Ctrl+C to stop)"
    while true; do
      clear
      echo "─── $(date +%H:%M:%S) ───"
      "$0" summary
      sleep 5
    done
    ;;

  *)
    echo "Unknown mode: $MODE"
    echo ""
    head -20 "$0" | tail -18
    exit 1
    ;;
esac
