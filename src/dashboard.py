import json
import time
import os
from rich.live import Live
from rich.layout import Layout
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich.console import Console
from datetime import datetime

EXECUTOR_FILE = "dashboard-executor.json"
WATCHER_FILE = "dashboard-watcher.json"

def load_json(path):
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r") as f:
            return json.load(f)
    except:
        return None

def make_header(exec_state):
    if not exec_state:
        return Panel(Text("Waiting for bot...", style="bold yellow"), style="red")
    
    timestamp = datetime.fromtimestamp(exec_state.get("timestamp", time.time()) / 1000).strftime("%H:%M:%S")
    mode = exec_state.get("mode", "UNKNOWN")
    cash = exec_state.get("cash", exec_state.get("balance", 0))
    portfolio = exec_state.get("portfolio", cash)
    pnl = exec_state.get("totalPnL", 0)
    
    pnl_style = "green" if pnl >= 0 else "red"
    mode_style = "bold green" if mode == "LIVE" else "bold yellow"
    
    grid = Table.grid(expand=True)
    grid.add_column(justify="left", ratio=1)
    grid.add_column(justify="center", ratio=1)
    grid.add_column(justify="right", ratio=1)
    
    grid.add_row(
        f"[bold cyan]MIRROR-STRIKE[/bold cyan] | [{mode_style}]{mode}[/{mode_style}]",
        f"Cash: [bold gold1]${cash:.2f}[/bold gold1] | Portfolio: [bold green]${portfolio:.2f}[/bold green]",
        f"Updated: {timestamp} | PnL: [{pnl_style}]${pnl:.2f}[/{pnl_style}]"
    )
    return Panel(grid, style="blue")

def make_targets_panel(watcher_state):
    table = Table(title="🎯 Targets Monitor", expand=True)
    table.add_column("Address", style="cyan")
    table.add_column("Last Check", justify="right")
    table.add_column("Tx Processed", justify="right")

    if not watcher_state:
        return Panel(table)

    targets = watcher_state.get("targets", [])
    
    for t in targets:
        # lastChecked is unix timestamp (seconds)
        ts = t.get("lastChecked", 0)
        time_str = datetime.fromtimestamp(ts).strftime("%H:%M:%S") if ts > 0 else "Never"
        
        table.add_row(
            t.get("address", "")[:10] + "..." + t.get("address", "")[-4:],
            time_str,
            str(t.get("txCount", 0))
        )

    return Panel(table, border_style="cyan")

def make_positions_panel(exec_state):
    table = Table(title="💼 Positions", expand=True)
    table.add_column("Asset", style="magenta")
    table.add_column("Size", justify="right")
    table.add_column("Avg Entry", justify="right")
    table.add_column("Total Cost", justify="right")

    if not exec_state:
        return Panel(table)

    positions = exec_state.get("positions", [])
    if not positions:
         return Panel(Text("No active positions.", justify="center", style="dim"), title="💼 Positions", border_style="magenta")

    for pos in positions:
        # pos is [key, value] if from Map.entries() but I serialized Array.from(values())
        # Let's check executor.ts: Array.from(this.dryRunState.virtualPositions.values())
        # So it's an object.
        
        # If it was entries(), it would be [key, obj].
        # Let's assume object.
        
        asset = pos.get("asset", "Unknown")
        size = pos.get("size", 0)
        avg = pos.get("averageEntryPrice", 0)
        cost = pos.get("totalCost", 0)
        
        table.add_row(
            asset[:15] + "..." if len(asset) > 15 else asset,
            f"{size:.4f}",
            f"${avg:.3f}",
            f"${cost:.2f}"
        )

    return Panel(table, border_style="magenta")

def make_last_trade_panel(exec_state):
    if not exec_state or not exec_state.get("lastTrade"):
        return Panel(Text("No recent trades.", justify="center", style="dim"), title="⚡ Last Trade", border_style="yellow")

    trade = exec_state.get("lastTrade")
    side = trade.get("side", "UNKNOWN")
    style = "green" if side == "BUY" else "red"
    
    text = Text()
    text.append(f"{side}", style=f"bold {style}")
    text.append(f" {trade.get('title', 'Unknown Market')}\n")
    text.append(f"Price: ${trade.get('price', 0):.3f} | Size: {trade.get('size', 0):.4f}\n")
    if trade.get("pnl"):
        pnl = trade.get("pnl")
        pnl_style = "green" if pnl > 0 else "red"
        text.append(f"Realized PnL: ", style="bold")
        text.append(f"${pnl:.2f}", style=pnl_style)
    
    return Panel(text, title="⚡ Last Trade", border_style="yellow")

def make_layout():
    layout = Layout()
    layout.split_column(
        Layout(name="header", size=3),
        Layout(name="body")
    )
    layout["body"].split_row(
        Layout(name="left", ratio=1),
        Layout(name="right", ratio=1)
    )
    layout["left"].split_column(
        Layout(name="targets", ratio=2),
        Layout(name="last_trade", ratio=1)
    )
    return layout

def run_dashboard():
    console = Console()
    layout = make_layout()

    with Live(layout, refresh_per_second=2, screen=True):
        while True:
            exec_state = load_json(EXECUTOR_FILE)
            watcher_state = load_json(WATCHER_FILE)
            
            layout["header"].update(make_header(exec_state))
            layout["left"]["targets"].update(make_targets_panel(watcher_state))
            layout["left"]["last_trade"].update(make_last_trade_panel(exec_state))
            layout["right"].update(make_positions_panel(exec_state))
            time.sleep(0.5)

if __name__ == "__main__":
    try:
        run_dashboard()
    except KeyboardInterrupt:
        pass
