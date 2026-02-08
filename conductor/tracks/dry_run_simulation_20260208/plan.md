# Implementation Plan - Dry-Run Simulation Mode

## Phase 1: Configuration & Infrastructure
- [ ] Task: Create a `Config` module/service to centrally manage environment variables, including `DRY_RUN`.
    - [ ] Sub-task: Write Tests for Config loading and validation.
    - [ ] Sub-task: Implement `Config` loader using `dotenv`.
- [ ] Task: specific "Dry Run" logger or log formatting.
    - [ ] Sub-task: Write Tests for log formatting.
    - [ ] Sub-task: Implement structured logging with a standard format that supports a `[DRY-RUN]` tag.

## Phase 2: Mock Executor Implementation
- [ ] Task: Define a common `IExecutor` interface for trade execution.
    - [ ] Sub-task: Refactor existing code (if any) to extract the execution logic into an interface.
- [ ] Task: Implement `MockExecutor` for dry-run mode.
    - [ ] Sub-task: Write Tests for `MockExecutor` ensuring it logs outputs and returns success.
    - [ ] Sub-task: Implement `MockExecutor` class that adheres to `IExecutor`.
- [ ] Task: Integrate `MockExecutor` into the main application factory.
    - [ ] Sub-task: Update main entry point to instantiate `MockExecutor` when `DRY_RUN=true`.

## Phase 3: Risk Engine & State Simulation Integration
- [ ] Task: Ensure Risk Engine runs in dry-run mode.
    - [ ] Sub-task: Write Tests to verify Risk Engine is invoked even when using `MockExecutor`.
    - [ ] Sub-task: Verify/Adjust `RiskEngine` to not bypass checks based on the executor type.
- [ ] Task: Implement basic virtual state tracking (optional for MVP, but good for verification).
    - [ ] Sub-task: Write Tests for virtual position updates.
    - [ ] Sub-task: Update `MockExecutor` to maintain a simple in-memory list of "filled" orders.

## Phase 4: End-to-End Verification
- [ ] Task: Run a full simulation.
    - [ ] Sub-task: Create a manual test script or integration test that runs the bot in dry-run mode for a set period.
    - [ ] Sub-task: Verify logs to ensure no real API calls were made and "trades" were logged correctly.
- [ ] Task: Conductor - User Manual Verification 'End-to-End Verification' (Protocol in workflow.md)
