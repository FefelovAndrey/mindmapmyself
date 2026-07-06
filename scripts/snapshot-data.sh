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
TMP_BACKUP=$(mktemp)
cp "$DATA_FILE" "$TMP_BACKUP"

git fetch origin "$BRANCH" 2>/dev/null || true

if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git checkout "$BRANCH"
  git pull --ff-only origin "$BRANCH" 2>/dev/null || true
else
  git checkout -b "$BRANCH" "origin/$BRANCH" 2>/dev/null || git checkout -b "$BRANCH"
fi

mkdir -p "$(dirname "$DATA_FILE")"
cp "$TMP_BACKUP" "$DATA_FILE"
rm "$TMP_BACKUP"

git add -f "$DATA_FILE"

if git diff --cached --quiet; then
  echo "Нет изменений в $DATA_FILE — коммит не нужен"
  FINAL_BACKUP=$(mktemp)
  cp "$DATA_FILE" "$FINAL_BACKUP"
  git checkout "$CURRENT"
  mkdir -p "$(dirname "$DATA_FILE")"
  cp "$FINAL_BACKUP" "$DATA_FILE"
  rm "$FINAL_BACKUP"
  exit 0
fi

git commit -m "$MSG"
git push -u origin "$BRANCH"

FINAL_BACKUP=$(mktemp)
cp "$DATA_FILE" "$FINAL_BACKUP"
git checkout "$CURRENT"
mkdir -p "$(dirname "$DATA_FILE")"
cp "$FINAL_BACKUP" "$DATA_FILE"
rm "$FINAL_BACKUP"

echo "Снимок отправлен в $BRANCH"
