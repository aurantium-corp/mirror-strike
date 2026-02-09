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
    ratio = exec_state.get("mirrorRatio", "N/A")

    pnl_style = "green" if pnl >= 0 else "red"
    mode_style = "bold green" if mode == "LIVE" else "bold yellow"

    grid = Table.grid(expand=True)
    grid.add_column(justify="left", ratio=1)
    grid.add_column(justify="center", ratio=1)
    grid.add_column(justify="right", ratio=1)

    ratio_str = f"{ratio}x" if isinstance(ratio, (int, float)) else ratio
    grid.add_row(
        f"[bold cyan]MIRROR-STRIKE[/bold cyan] | [{mode_style}]{mode}[/{mode_style}] | Ratio: [bold white]{ratio_str}[/bold white]",
        f"Cash: [bold gold1]${cash:.2f}[/bold gold1] | Portfolio: [bold green]${portfolio:.2f}[/bold green]",
        f"Updated: {timestamp} | PnL: [{pnl_style}]${pnl:.2f}[/{pnl_style}]"
    )
    return Panel(grid, style="blue")

def make_whale_panel(watcher_state):
    if not watcher_state:
        return Panel(Text("Waiting for watcher...", style="dim"), title="🐋 Whale Portfolio", border_style="bright_blue")

    targets = watcher_state.get("targets", [])
    if not targets:
        return Panel(Text("No targets configured.", style="dim"), title="🐋 Whale Portfolio", border_style="bright_blue")

    text = Text()
    for i, t in enumerate(targets):
        addr = t.get("address", "")
        short_addr = addr[:10] + "..." + addr[-4:] if len(addr) > 14 else addr
        usdc = t.get("usdcBalance", 0)
        positions = t.get("positions", [])

        if i > 0:
            text.append("\n")
        text.append(f"{short_addr}\n", style="bold cyan")
        text.append("USDC: ", style="bold")
        text.append(f"${usdc:,.2f}\n", style="bold gold1")

        if positions:
            for p in positions:
                title = p.get("title", "?")
                outcome = p.get("outcome", "")
                size = p.get("size", "0")
                avg = p.get("avgPrice", "0")
                cur = p.get("curPrice", "0")
                outcome_style = "green" if outcome.lower() == "yes" else "red" if outcome.lower() == "no" else "white"
                # Truncate long titles
                if len(title) > 30:
                    title = title[:28] + ".."
                text.append(f"  {title} ", style="white")
                text.append(f"[{outcome}]", style=outcome_style)
                text.append(f" {size}@{avg}")
                # Show current price if available and different from avg
                try:
                    if float(cur) > 0:
                        text.append(f" now:{cur}", style="dim")
                except (ValueError, TypeError):
                    pass
                text.append("\n")
        else:
            text.append("  No positions\n", style="dim")

    return Panel(text, title="🐋 Whale Portfolio", border_style="bright_blue")

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
    table = Table(title="💼 My Positions", expand=True)
    table.add_column("Asset", style="magenta")
    table.add_column("Size", justify="right")
    table.add_column("Avg Entry", justify="right")
    table.add_column("Total Cost", justify="right")

    if not exec_state:
        return Panel(table)

    positions = exec_state.get("positions", [])
    if not positions:
         return Panel(Text("No active positions.", justify="center", style="dim"), title="💼 My Positions", border_style="magenta")

    for pos in positions:
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

def make_my_last_trade_panel(exec_state):
    if not exec_state or not exec_state.get("lastTrade"):
        return Panel(Text("No recent trades.", justify="center", style="dim"), title="⚡ My Last Trade", border_style="yellow")

    trade = exec_state.get("lastTrade")
    side = trade.get("side", "UNKNOWN")
    style = "green" if side == "BUY" else "red"

    text = Text()
    text.append(f"{side}", style=f"bold {style}")
    text.append(f" {trade.get('title', 'Unknown Market')}\n")

    # Show amount info
    amount = trade.get("amount", trade.get("shares", 0))
    if amount:
        text.append(f"Amount: ${amount:.2f}\n" if trade.get("amount") else f"Shares: {amount:.4f}\n")

    if trade.get("price"):
        text.append(f"Price: ${trade.get('price', 0):.3f} | Size: {trade.get('size', 0):.4f}\n")
    if trade.get("pnl"):
        pnl = trade.get("pnl")
        pnl_style = "green" if pnl > 0 else "red"
        text.append(f"Realized PnL: ", style="bold")
        text.append(f"${pnl:.2f}", style=pnl_style)

    return Panel(text, title="⚡ My Last Trade", border_style="yellow")

def make_whale_last_trade_panel(watcher_state):
    if not watcher_state or not watcher_state.get("lastWhaleTrade"):
        return Panel(Text("No whale trades yet.", justify="center", style="dim"), title="🐋 Whale Last Trade", border_style="bright_blue")

    trade = watcher_state.get("lastWhaleTrade")
    side = trade.get("side", "UNKNOWN")
    style = "green" if side == "BUY" else "red"

    text = Text()
    text.append(f"{side}", style=f"bold {style}")
    text.append(f" {trade.get('title', 'Unknown Market')}\n")

    price = trade.get("price")
    size = trade.get("size")
    if price is not None:
        text.append(f"Price: {price} | Size: {size}\n")

    ts = trade.get("timestamp", 0)
    if ts > 0:
        # Handle both ms and s timestamps
        if ts > 100000000000:
            ts = ts / 1000
        time_str = datetime.fromtimestamp(ts).strftime("%H:%M:%S")
        text.append(f"Time: {time_str}\n", style="dim")

    return Panel(text, title="🐋 Whale Last Trade", border_style="bright_blue")

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
        Layout(name="whale", ratio=2),
        Layout(name="targets", ratio=1)
    )
    layout["right"].split_column(
        Layout(name="positions", ratio=2),
        Layout(name="last_trades", ratio=1)
    )
    layout["right"]["last_trades"].split_row(
        Layout(name="whale_trade", ratio=1),
        Layout(name="my_trade", ratio=1)
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
            layout["left"]["whale"].update(make_whale_panel(watcher_state))
            layout["left"]["targets"].update(make_targets_panel(watcher_state))
            layout["right"]["positions"].update(make_positions_panel(exec_state))
            layout["right"]["last_trades"]["whale_trade"].update(make_whale_last_trade_panel(watcher_state))
            layout["right"]["last_trades"]["my_trade"].update(make_my_last_trade_panel(exec_state))
            time.sleep(0.5)

if __name__ == "__main__":
    try:
        run_dashboard()
    except KeyboardInterrupt:
        pass
