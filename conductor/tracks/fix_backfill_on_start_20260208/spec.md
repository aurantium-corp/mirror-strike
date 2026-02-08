# Track Specification: Fix startup behavior to prevent processing historical trades

## Objective
Prevent the bot from "catching up" on historical trades when it starts up. The bot should only mirror actions that occur *after* it has been started. Currently, the bot resumes from the last saved state, which causes it to execute a flood of old orders if it has been offline for a while.

## Root Cause Analysis
- The `Watcher` class loads a persistent state file (`.watcher-state.json`) which contains the `lastChecked` timestamp for each target.
- On startup, the bot uses this old timestamp to query the API for new trades.
- If `lastChecked` is in the past, the API returns historical trades, which the bot then executes (or logs in dry-run), causing a flood of "duplicate" orders.

## Proposed Fix
- In `Watcher.start()`, explicitly reset the `lastChecked` timestamp for ALL configured targets to the current time (`Date.now()`).
- This "fast-forwards" the state, ensuring that only trades with timestamps > NOW are processed.
- This change should apply to both new targets and existing targets loaded from the state file.

## Acceptance Criteria
- [ ] When the bot starts, it logs that it is synchronizing target state to the current time.
- [ ] No historical trades are executed/logged immediately upon startup.
- [ ] New trades (actions) made by the target *after* startup are correctly detected and executed.
