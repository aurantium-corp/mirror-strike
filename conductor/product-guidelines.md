# Product Guidelines

## Core Principles
- **Reliability First:** The safety of funds and correctness of execution are paramount. Every trade decision must be verified, and fail-safes must be in place to prevent unintended loss.
- **Observability:** The system must provide complete transparency into its operations. Operators should be able to instantly assess the bot's health, active positions, and recent actions through logs and dashboards.

## Architecture & Code Style
- **Modular Design:** The codebase should be organized into distinct, decoupled modules (e.g., `executor`, `watcher`, `risk-engine`) to enhance maintainability and testability.
- **Strong Typing:** Leverage TypeScript's strict type system to catch errors at compile-time. Avoid `any` types and define clear interfaces for all data structures, especially external API responses.

## Testing & QA
- **Dry-Run Capability:** A robust "dry-run" mode is mandatory. It must accurately simulate the execution path (logging intended trades) without sending transactions, allowing for safe testing of strategies.
- **Comprehensive Testing:** Implement a strong suite of unit tests for core logic (like sizing calculations) and integration tests that verify interaction with the Polymarket APIs (using mocks where appropriate).

## Configuration & Security
- **Environment-Based Config:** All configuration, especially sensitive credentials (private keys, API keys), must be managed via environment variables.
- **Zero Hardcoded Secrets:** Strictly forbid embedding secrets in the source code. The application should fail to start if required environment variables are missing.

## Logging & Error Handling
- **Structured Logging:** Emit logs in a structured format (JSON preferred) to enable automated parsing and ingestion into monitoring tools.
- **Resilient Error Handling:** Implement robust error handling patterns, such as retries with exponential backoff for network requests, to ensure the bot remains stable under intermittent network issues.
