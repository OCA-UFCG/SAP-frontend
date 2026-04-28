# Agent Guidelines

## Core Rule

- All files in `docs/` are living documents.
- Whenever a prompt changes behavior, contracts, schema, architecture, performance, the EE flow, client/server boundaries, or operational assumptions, the affected files in `docs/` must be updated in the same iteration.
- A task is not complete if the code changed in a meaningful way and the agent-facing context in `docs/` is left stale.

## Purpose

- Make context retrieval easier for the agents used by the development team.
- Reduce reliance on implicit memory and broad codebase rereads for recurring work.

## How to Use These Files

- `docs/architecture.md`: architecture, execution boundaries, and main flow.
- `docs/contentful-schema.md`: Contentful schema and risks, especially around `panelLayer`.
- `docs/gee-layers.md`: Earth Engine layer pipeline, visualization rules, cache, and warmup.
- `docs/analysis-contract.md`: territorial analysis contract and legacy compatibility.
- `docs/performance-notes.md`: hotspots, guardrails, and regression signals.

## When to Update Each File

- Update `architecture.md` when changing flow between server, client, map, sidebar, analysis, or APIs.
- Update `contentful-schema.md` when changing queries, fields, schemas, ownership, or CMS fallback behavior.
- Update `gee-layers.md` when changing EE payloads, cache, warmup, band handling, visualization rules, or the layer-side `imageData` contract.
- Update `analysis-contract.md` when changing analysis shape, year fallback, ranking behavior, derived legend behavior, or empty-state behavior.
- Update `performance-notes.md` when changing memoization, context boundaries, payload size, cache strategy, or rendering strategy.

## Quality Rules

- Write only what is confirmed by code, tests, or an explicit team decision.
- Clearly distinguish confirmed behavior from open questions.
- Avoid generic prose. Record invariants, risks, fallbacks, and change impact.
- Do not document secrets, tokens, credentials, or details that weaken system security.

## Consistency Rule

- If a file in `docs/` contradicts the current code, correcting the documentation takes priority in the same iteration where the mismatch is found.
- If a change is still in transition, document both the current state and the target state explicitly.
