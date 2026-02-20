#!/bin/bash
# 啟動 Mirror-Strike 機器人

cd /opt/mirror-strike

# 檢查是否已經在運行
if pgrep -f "ts-node.*src/index.ts" > /dev/null; then
  echo "[ERROR] 機器人已經在運行中"
  exit 1
fi

# 清理舊的狀態檔案
rm -f .watcher-state-dryrun.json dashboard-executor.json dashboard-watcher.json

echo "[INFO] 啟動 Mirror-Strike..."
exec ./node_modules/.bin/ts-node src/index.ts > /var/log/mirror-strike.log 2>&1 &
echo "[INFO] PID: $!"
sleep 3

# 檢查是否成功啟動
if pgrep -f "ts-node.*src/index.ts" > /dev/null; then
  echo "[SUCCESS] 機器人啟動成功"
else
  echo "[ERROR] 機器人啟動失敗"
  exit 1
fi
