#!/bin/bash

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=3000
LOG="$APP_DIR/.launch.log"

# Если сервер уже запущен — просто открываем браузер
if lsof -ti:$PORT > /dev/null 2>&1; then
  xdg-open "http://localhost:$PORT" 2>/dev/null &
  exit 0
fi

# Запускаем Next.js в фоне
cd "$APP_DIR"
nohup npm run dev > "$LOG" 2>&1 &
SERVER_PID=$!

# Ждём пока порт откроется (до 30 секунд)
echo "Запуск Mind Map Editor..."
for i in $(seq 1 30); do
  if lsof -ti:$PORT > /dev/null 2>&1; then
    break
  fi
  sleep 1
done

# Открываем браузер
xdg-open "http://localhost:$PORT" 2>/dev/null &

echo "Mind Map Editor запущен. PID сервера: $SERVER_PID"
echo "Лог: $LOG"
