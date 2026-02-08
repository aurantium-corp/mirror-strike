# Track Specification: Implement a robust dry-run simulation mode

## Objective
Enable a "Dry-Run" mode for the Mirror-Strike bot that simulates trade execution without interacting with the live Polymarket exchange. This mode should log all intended actions, validate logic, and verify risk checks as if they were real, ensuring system reliability and strategy correctness.

## Core Features
1.  **Configuration Flag:**
    -   Introduce a `DRY_RUN` environment variable (boolean).
    -   The system must read this flag on startup and clearly indicate the running mode in the logs.

2.  **Mock Executor:**
    -   Create a mock implementation of the order execution interface.
    -   When `DRY_RUN=true`, the `Executor` should bypass the actual API call to the Polymarket CLOB.
    -   Instead of sending a transaction, it should log the full details of the order (market, side, price, size) to the console and/or a structured log file.

3.  **State Simulation:**
    -   The dry-run mode should simulate order success.
    -   It should update internal state (e.g., "virtual" position tracking) to allow testing of subsequent logic that depends on previous fills.

4.  **Logging & Verification:**
    -   Dry-run actions must be clearly distinguishable in logs (e.g., prefixed with `[DRY-RUN]`).
    -   Output should include calculated metrics like position size and risk check results.

## Acceptance Criteria
-   [ ] Setting `DRY_RUN=true` prevents any real transactions from being sent to the blockchain or Polymarket API.
-   [ ] The bot starts up and connects to data streams (e.g., market prices) normally in dry-run mode.
-   [ ] "Trades" triggered by the strategy are logged with correct details.
-   [ ] Risk management checks (e.g., daily loss limit) are still evaluated in dry-run mode.
-   [ ] Unit/Integration tests exist to verify the dry-run behavior.
