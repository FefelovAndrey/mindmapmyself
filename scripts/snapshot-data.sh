#!/usr/bin/env bash
# Сохраняет data/mindmap.json снимком в ветку data/snapshots без
# переключения текущей рабочей ветки (через временный git worktree).
set -euo pipefail

DATA_FILE="data/mindmap.json"
BRANCH="data/snapshots"
MSG="data: snapshot $(date +%Y-%m-%d)"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT"

if [[ ! -f "$DATA_FILE" ]]; then
  echo "Нет файла $DATA_FILE"
  exit 1
fi

WT="$(mktemp -d)"
cleanup() {
  cd "$ROOT" || true
  git worktree remove --force "$WT" 2>/dev/null || true
  rm -rf "$WT"
}
trap cleanup EXIT

git fetch origin "$BRANCH" 2>/dev/null || true

if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git worktree add --force "$WT" "$BRANCH" >/dev/null
  git -C "$WT" pull --ff-only origin "$BRANCH" 2>/dev/null || true
elif git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  git worktree add --force -b "$BRANCH" "$WT" "origin/$BRANCH" >/dev/null
else
  git worktree add --force -b "$BRANCH" "$WT" >/dev/null
fi

mkdir -p "$WT/$(dirname "$DATA_FILE")"
cp "$ROOT/$DATA_FILE" "$WT/$DATA_FILE"

cd "$WT"
git add -f "$DATA_FILE"

if git diff --cached --quiet; then
  echo "Нет изменений в $DATA_FILE — коммит не нужен"
  exit 0
fi

git commit -m "$MSG"
git push -u origin "$BRANCH"
echo "Снимок отправлен в $BRANCH"
