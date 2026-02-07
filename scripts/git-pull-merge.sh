#!/bin/bash
# Pull latest and merge. Run from repo root:
#   cd /Users/ketan/Documents/warmpawzecodev && ./scripts/git-pull-merge.sh
set -e
git fetch origin
BRANCH=$(git branch --show-current)
echo "Current branch: $BRANCH"
git pull origin "$BRANCH"
echo "Pull and merge done. Push with: git push origin $BRANCH"
