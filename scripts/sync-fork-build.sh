#!/usr/bin/env bash
# Put this checkout's built lib/ over the copy a DSH profile installed from npm.
#
#   scripts/sync-fork-build.sh [profile]        (default profile: web)
#
# `dsh plugin install` restores the registry build of the pinned version, which
# silently drops a fork's changes. Run before DSH starts (for example as a
# systemd ExecStartPre) so the fork's build is always the one that boots.
# Never fails: a problem here must not keep DSH from starting.
profile="${1:-web}"
home="${DSH_HOME:-$HOME/.dsh}"
source_root="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
target="$home/profiles/$profile/node_modules/@norman-else/dsh-claude"

version() { python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$1/package.json" 2>/dev/null; }

if [ ! -f "$source_root/lib/index.js" ] && [ ! -f "$source_root/lib/index.mjs" ]; then
  echo "dsh-claude fork sync: no build in $source_root/lib; left the installed copy alone"
  exit 0
fi
if [ ! -d "$target/lib" ]; then
  echo "dsh-claude fork sync: $target is not installed; nothing to do"
  exit 0
fi
ours="$(version "$source_root")"
theirs="$(version "$target")"
if [ -z "$ours" ] || [ "$ours" != "$theirs" ]; then
  echo "dsh-claude fork sync: installed version ${theirs:-unknown} differs from the fork's ${ours:-unknown}; left it alone"
  exit 0
fi
changed="$(rsync -a --delete --itemize-changes "$source_root/lib/" "$target/lib/" 2>&1 | grep -c '^[<>ch*]' || true)"
if [ "${changed:-0}" != "0" ]; then
  echo "dsh-claude fork sync: restored the fork build over the installed copy ($changed entries)"
fi
exit 0
