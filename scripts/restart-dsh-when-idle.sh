#!/usr/bin/env bash
# Restart DSH once no Claude turn is running, so the restart does not abort one.
#
#   scripts/restart-dsh-when-idle.sh [max-wait-seconds]
#
# Reads the activity file dsh-claude keeps (running turn count, refreshed every
# few seconds). Restarts at once when the file is missing or stale, which means
# DSH is not running this build or is not running at all. After the wait limit
# it restarts anyway, unless DSH_RESTART_FORCE=0.
set -u
unit="${DSH_UNIT:-dsh.service}"
home="${DSH_HOME:-$HOME/.dsh}"
file="$home/plugins/dsh-claude/activity.json"
limit="${1:-1800}"
settle="${DSH_RESTART_SETTLE:-6}"
started=$(date +%s)
idle_since=0

running() {
  # Prints the running turn count, or "stale" when the file cannot be trusted.
  python3 - "$file" <<'PY' 2>/dev/null || echo stale
import json, sys, time
data = json.load(open(sys.argv[1]))
fresh = time.time() * 1000 - data["updatedAt"] < 90_000
print("stale" if not fresh or data.get("stopped") else int(data["running"]))
PY
}

while :; do
  now=$(date +%s)
  count=$(running)
  if [ "$count" = "stale" ]; then
    echo "dsh-claude reports no activity file to trust; restarting $unit now"
    break
  fi
  if [ "$count" = "0" ]; then
    [ "$idle_since" = 0 ] && idle_since=$now
    # Idle has to hold for a moment: a follow-up turn opens right after one ends.
    if [ $((now - idle_since)) -ge "$settle" ]; then
      echo "no Claude turn running; restarting $unit"
      break
    fi
  else
    idle_since=0
  fi
  if [ $((now - started)) -ge "$limit" ]; then
    if [ "${DSH_RESTART_FORCE:-1}" = "0" ]; then
      echo "still $count turn(s) running after ${limit}s; not restarting" >&2
      exit 1
    fi
    echo "still $count turn(s) running after ${limit}s; restarting $unit anyway"
    break
  fi
  sleep 2
done
exec systemctl restart "$unit"
