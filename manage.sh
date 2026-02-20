#!/bin/bash
# Mirror-Strike 管理腳本

case "$1" in
  start)
    echo "=== 啟動 Mirror-Strike ==="
    /opt/mirror-strike/start-bot.sh
    ;;
  dashboard)
    echo "=== 啟動 Dashboard ==="
    /opt/mirror-strike/start-dashboard.sh
    ;;
  start-all)
    echo "=== 啟動所有服務 ==="
    /opt/mirror-strike/start-bot.sh
    sleep 2
    /opt/mirror-strike/start-dashboard.sh
    ;;
  stop)
    echo "=== 停止所有服務 ==="
    pkill -9 -f "ts-node.*src/index.ts" 2>/dev/null
    pkill -9 -f "node.*dashboard-server" 2>/dev/null
    kill -9 $(lsof -t -i:3001) 2>/dev/null
    echo "✅ 所有服務已停止"
    ;;
  restart)
    echo "=== 重啟所有服務 ==="
    $0 stop
    sleep 2
    $0 start-all
    ;;
  status)
    echo "=== 服務狀態 ==="
    if pgrep -f "ts-node.*src/index.ts" > /dev/null; then
      echo "✅ Mirror-Strike: 運行中 (PID: $(pgrep -f "ts-node.*src/index.ts"))"
    else
      echo "❌ Mirror-Strike: 未運行"
    fi
    
    if lsof -i :3001 > /dev/null 2>&1; then
      echo "✅ Dashboard: 運行中 (端口 3001)"
    else
      echo "❌ Dashboard: 未運行"
    fi
    
    echo ""
    echo "=== API 測試 ==="
    curl -s http://127.0.0.1:3001/api/health 2>&1 | grep -q "ok" && echo "✅ Dashboard API: 正常" || echo "❌ Dashboard API: 異常"
    ;;
  *)
    echo "用法: $0 {start|dashboard|start-all|stop|restart|status}"
    exit 1
    ;;
esac
