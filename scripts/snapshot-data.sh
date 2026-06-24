#!/usr/bin/env bash
set -euo pipefail

DATA_FILE="data/mindmap.json"
BRANCH="data/snapshots"
MSG="data: snapshot $(date +%Y-%m-%d)"

if [[ ! -f "$DATA_FILE" ]]; then
  echo "Нет файла $DATA_FILE"
  exit 1
fi

CURRENT=$(git branch --show-current)

git fetch origin "$BRANCH" 2>/dev/null || true

if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git checkout "$BRANCH"
else
  git checkout -b "$BRANCH"
fi

git add -f "$DATA_FILE"

if git diff --cached --quiet; then
  echo "Нет изменений в $DATA_FILE — коммит не нужен"
  git checkout "$CURRENT"
  exit 0
fi

git commit -m "$MSG"
git push -u origin "$BRANCH"
git checkout "$CURRENT"

echo "Снимок отправлен в $BRANCH"
