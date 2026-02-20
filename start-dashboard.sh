#!/bin/bash
# 啟動 Dashboard 監控介面

cd /opt/mirror-strike/dashboard-server

# 檢查是否已經在運行
if lsof -i :3001 > /dev/null 2>&1; then
  echo "[ERROR] Dashboard 已經在運行中 (端口 3001)"
  exit 1
fi

echo "[INFO] 啟動 Dashboard..."
exec node dashboard-server.js > /var/log/ms-dashboard.log 2>&1 &
echo "[INFO] PID: $!"
sleep 2

# 檢查是否成功啟動
if curl -s http://127.0.0.1:3001/api/health > /dev/null 2>&1; then
  echo "[SUCCESS] Dashboard 啟動成功"
else
  echo "[ERROR] Dashboard 啟動失敗"
  exit 1
fi
