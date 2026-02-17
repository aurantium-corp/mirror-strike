#!/bin/bash
# Mirror-Strike 本地监控脚本
# 使用方式: ./local-monitor.sh [status|logs|restart|stop|start]

SERVER_IP="207.148.113.244"
SERVER_PASS="=6zXJX=R.jz$=Y!v"
SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=10"

show_help() {
    echo "Mirror-Strike 远程管理脚本"
    echo ""
    echo "用法: $0 [命令]"
    echo ""
    echo "命令:"
    echo "  status      查看所有服务状态 (默认)"
    echo "  dashboard   打开 Dashboard 网页"
    echo "  logs        查看 mirror-strike 日志"
    echo "  logs-dashboard 查看 dashboard 日志"
    echo "  restart     重启 mirror-strike"
    echo "  restart-dash   重启 dashboard"
    echo "  stop        停止所有服务"
    echo "  start       启动所有服务"
    echo "  api         测试 API 状态"
    echo ""
}

check_status() {
    echo "=== 获取服务器状态 ==="
    sshpass -p "$SERVER_PASS" ssh $SSH_OPTS root@$SERVER_IP "
        echo '--- 端口监听 ---'
        ss -tlnp | grep -E '3000|3001'
        
        echo ''
        echo '--- PM2 进程 ---'
        pm2 status
        
        echo ''
        echo '--- 内存使用 ---'
        free -h | grep Mem
        
        echo ''
        echo '--- 磁盘使用 ---'
        df -h /opt/mirror-strike
    "
}

open_dashboard() {
    echo "正在打开 Dashboard..."
    open "https://www.aurantium.cc/ms-dashboard/" 2>/dev/null || \
    xdg-open "https://www.aurantium.cc/ms-dashboard/" 2>/dev/null || \
    echo "请手动打开: https://www.aurantium.cc/ms-dashboard/"
}

view_logs() {
    echo "=== Mirror-Strike 日志 (最近 30 行) ==="
    sshpass -p "$SERVER_PASS" ssh $SSH_OPTS root@$SERVER_IP "
        pm2 logs mirror-strike --lines 30 --nostream 2>&1 | tail -40
    "
}

view_dashboard_logs() {
    echo "=== Dashboard 日志 ==="
    sshpass -p "$SERVER_PASS" ssh $SSH_OPTS root@$SERVER_IP "
        cat /tmp/dashboard.log | tail -50
    "
}

restart_bot() {
    echo "正在重启 mirror-strike..."
    sshpass -p "$SERVER_PASS" ssh $SSH_OPTS root@$SERVER_IP "
        cd /opt/mirror-strike
        pm2 restart mirror-strike
    "
    echo "重启完成"
}

restart_dashboard() {
    echo "正在重启 dashboard..."
    sshpass -p "$SERVER_PASS" ssh $SSH_OPTS root@$SERVER_IP "
        pkill -f 'dashboard-server.js' 2>/dev/null
        sleep 1
        cd /opt/mirror-strike/dashboard-server
        nohup node dashboard-server.js > /tmp/dashboard.log 2>&1 &
    "
    echo "重启完成"
}

stop_all() {
    echo "正在停止所有服务..."
    sshpass -p "$SERVER_PASS" ssh $SSH_OPTS root@$SERVER_IP "
        pm2 stop all
    "
}

start_all() {
    echo "正在启动所有服务..."
    sshpass -p "$SERVER_PASS" ssh $SSH_OPTS root@$SERVER_IP "
        pm2 resurrect 2>/dev/null
        if ! ss -tlnp | grep -q ':3001'; then
            cd /opt/mirror-strike/dashboard-server
            nohup node dashboard-server.js > /tmp/dashboard.log 2>&1 &
        fi
    "
}

test_api() {
    echo "=== 测试 API ==="
    curl -s "https://www.aurantium.cc/ms-dashboard/api/status" | python3 -m json.tool 2>/dev/null || \
    curl -s "https://www.aurantium.cc/ms-dashboard/api/status"
}

# 主程序
case "${1:-status}" in
    status|s)
        check_status
        ;;
    dashboard|d)
        open_dashboard
        ;;
    logs|l)
        view_logs
        ;;
    logs-dashboard|ld)
        view_dashboard_logs
        ;;
    restart|r)
        restart_bot
        ;;
    restart-dash|rd)
        restart_dashboard
        ;;
    stop)
        stop_all
        ;;
    start)
        start_all
        ;;
    api|a)
        test_api
        ;;
    help|h|-h|--help)
        show_help
        ;;
    *)
        echo "未知命令: $1"
        show_help
        exit 1
        ;;
esac
