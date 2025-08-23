# Broker Ranking & Auto Buy Bot — Design Document

This document describes the main feature replacing the "features" section on the landing page: a broker ranking engine alongside an automation-ready buy bot that reacts to post outcomes with strong safeguards.

## Goals
- Route actions to the best broker based on real-time and historical performance.
- Enable automation on signals from successful posts while minimizing risk from losing posts.
- Preserve transparency with logs, alerts, and explainable decisions.

## System Overview
- Ranking Engine produces a weighted score per broker.
- Signal Trust Score rates the author/post combination.
- Auto Buy Bot uses both scores plus user risk settings to decide and size actions.
- Risk Controls enforce global and per-trade limits.
- Execution Router sends orders to the highest-ranked healthy broker.

## Broker Ranking Engine
Inputs (normalized to 0–100):
- Execution Quality (fill rate, price improvement, latency)
- Fees & Commission (effective cost)
- Reliability/Uptime (API health, outage history)
- Slippage (avg. vs. reference price)
- Rejections/Error Rate

Example weights (editable via config):
- Execution: 30%
- Fees: 20%
- Reliability: 25%
- Slippage: 15%
- Reject/Error: 10%

Final score = Σ(weight_i × metric_i_normalized).

Health checks run continuously. Brokers below a health threshold are excluded until recovered.

## Signal Trust Score
- Author performance (success rate, PnL, Sharpe-like stability)
- Post-level metrics (backed testing tags, confidence tags)
- Recency weighting (recent outcomes weigh more)
- Community feedback (likes, follows) with caps to avoid gaming

Trust Score ∈ [0, 100]. Thresholds control automation eligibility.

## Auto Buy Bot Behavior
- Trigger on: posts meeting Trust Score threshold and user automation enabled.
- On successful posts: 
  - Increase author rolling trust modestly
  - Optionally auto-scale next allocation (bounded by max limits)
- On losing posts:
  - Reduce trust; optionally disable auto-actions for that author for a cool-down period
  - Tighten risk for future signals (smaller sizing, stricter stops)

### Sizing Logic
- Base allocation × f(Trust Score)
- Clamp by per-trade and daily max limits
- Respect portfolio exposure caps per sector/asset/country

### Risk Controls & Guardrails
- Max allocation per trade and per day
- Global drawdown limit; pause automation if breached
- Cool-down windows after losses or high volatility
- Mandatory stop-loss and optional take-profit presets
- Minimum liquidity and price filters
- Market state checks (halts, high spread, out of hours)

## Execution Routing
- Select top-ranked broker meeting health and instrument eligibility
- If rejected/timeouts, failover to next ranked broker
- Log all attempts and decisions (with timing and status)

## Transparency & Alerts
- Notification on: action executed, rejected, paused by risk, or broker failover
- Audit log keeps: signal data, trust score, broker score snapshot, final decision

## Configuration
- Editable weights, thresholds, limits per user
- Per-broker API credentials (never hard-coded; loaded from secure storage)
- Per-market trading hours and instrument eligibility

## Security Considerations
- No API keys in client code. Use server environment variables/secret storage
- Rate-limit automation endpoints; verify auth and ownership of settings
- Validate inputs; sanitize text fields to prevent injection
- Idempotent order endpoints to avoid duplicate sends

## Testing Strategy
- Unit: score computations, thresholds, health filters
- Integration: routing with simulated broker failures
- E2E: dry-run mode validating full decision and logging pipeline
- Backtesting harness for trust score weighting adjustments

## Integration Points
- Posts/Signals: read success/lose outcomes and author metrics
- Settings UI: user risk preferences, thresholds, broker connections
- Notifications: push/email for actions and risk events
- Observability: metrics dashboards for ranking and bot activity

## Roadmap
1. Scoring libraries and config surface
2. Read-only simulation mode and logs
3. Limited beta with paper trading broker
4. Production rollout with gradual caps

This feature is designed for performance, safety, and clarity, and fits the app’s modular architecture for future extensions.
