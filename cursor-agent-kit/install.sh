#!/usr/bin/env bash
# Installs Cursor agent rules from cursor-agent-kit into .cursor/rules/
set -euo pipefail

KIT_ROOT="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$KIT_ROOT/.." && pwd)"
RULES_SOURCE="$KIT_ROOT/rules"
RULES_TARGET="$REPO_ROOT/.cursor/rules"

if [[ ! -d "$RULES_SOURCE" ]]; then
  echo "ERROR: Rules folder not found: $RULES_SOURCE" >&2
  exit 1
fi

mkdir -p "$RULES_TARGET"

for f in "$RULES_SOURCE"/*.mdc; do
  cp -f "$f" "$RULES_TARGET/"
  echo "Installed: $(basename "$f")"
done

echo ""
echo "Done. Rules installed to: $RULES_TARGET"
echo "Restart Cursor or start a new Agent chat to load rules."
