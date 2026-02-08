# Implementation Plan - Fix Backfill on Start

## Phase 1: Logic Update
- [ ] Task: Modify `src/watcher.ts` to reset `lastChecked` on startup.
    - [ ] Sub-task: In `Watcher.start()`, iterate over `this.targets`.
    - [ ] Sub-task: Set `this.state[target].lastChecked = Math.floor(Date.now() / 1000)`.
    - [ ] Sub-task: Save the updated state immediately.

## Phase 2: Verification
- [ ] Task: specific test or verification.
    - [ ] Sub-task: Manually verify by running the bot and checking logs. (The user can do this).
    - [ ] Sub-task: Run `npm start` (dry run) and ensure no immediate "New Trade Detected" logs appear.
- [ ] Task: Conductor - User Manual Verification 'Fix Backfill' (Protocol in workflow.md)
