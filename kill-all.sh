#!/bin/bash
# 徹底清理所有 Mirror-Strike 相關進程

echo "=== 停止 Systemd 服務 ==="
systemctl stop mirror-strike ms-dashboard 2>/dev/null || true

echo "=== 停止 PM2 ==="
pm2 kill 2>/dev/null || true

echo "=== 殺死所有 Node 進程 ==="
pkill -9 -f "node" 2>/dev/null || true
pkill -9 -f "ts-node" 2>/dev/null || true

echo "=== 殺死佔用 3001 端口的進程 ==="
kill -9 $(lsof -t -i:3001) 2>/dev/null || true

echo "=== 等待清理完成 ==="
sleep 2

echo "=== 驗證清理結果 ==="
if ps aux | grep -E "node|pm2" | grep -v grep | grep -v "kill-all.sh" > /dev/null; then
  echo "⚠️ 仍有殘留進程:"
  ps aux | grep -E "node|pm2" | grep -v grep | grep -v "kill-all.sh"
else
  echo "✅ 所有進程已清理完畢"
fi

if lsof -i :3001 > /dev/null 2>&1; then
  echo "⚠️ 端口 3001 仍被占用"
else
  echo "✅ 端口 3001 已釋放"
fi
