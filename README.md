# SAP Frontend

Frontend application for the SAP platform, built with Next.js. The project combines institutional content from Contentful, platform layer metadata, Earth Engine-backed map rendering, and a detail view for territorial analysis.

## Stack Overview

- Next.js App Router
- React 19
- TypeScript
- Contentful GraphQL
- Google Earth Engine
- MapLibre and Leaflet
- Vitest and Storybook

## Prerequisites

- Node.js LTS
- npm

If you use `nvm`, run:

```bash
nvm install --lts
nvm use --lts
```

## Environment Setup

Use `env.sample.txt` as the starting point for local Contentful variables.

```bash
cp env.sample.txt .env.local
```

For map features backed by Google Earth Engine, server-side credentials must also be configured in the runtime environment. Do not commit secrets to the repository.

## Getting Started

Install dependencies and Playwright browsers:

```bash
npm install
npx playwright install --with-deps
```

Run the development server:

```bash
npm run dev
```

Open `http://localhost:3000` in the browser.

## Available Scripts

- `npm run dev`: start the development server.
- `npm run build`: build the app with the current webpack-based Next.js configuration.
- `npm run start`: start the production server.
- `npm run lint`: run ESLint.
- `npm run test`: run all Vitest projects.
- `npm run test:unit`: run the unit test project only.
- `npm run test:storybook`: run the Storybook test project only.
- `npm run storybook`: start Storybook locally.
- `npm run build-storybook`: build the Storybook bundle.
- `npm run format`: run Prettier across the repository.

## Agent Context Docs

The repository includes a dedicated set of agent-oriented context files under `docs/`:

- `docs/agent-guidelines.md`: central rules for how agents should use and maintain the docs.
- `docs/architecture.md`: architecture, runtime boundaries, and the main platform flow.
- `docs/contentful-schema.md`: Contentful schema assumptions, risks, and change protocol.
- `docs/gee-layers.md`: Earth Engine layer pipeline, visualization rules, cache behavior, and warmup behavior.
- `docs/analysis-contract.md`: territorial analysis contract, semantic rules, and legacy compatibility.
- `docs/performance-notes.md`: known hotspots, guardrails, and regression signals.

These files are living documents. If a prompt or code change affects architecture, contracts, schema, EE flow, performance, or other operational assumptions, the affected files in `docs/` must be updated in the same iteration.

## Development Notes

- `panelLayer.imageData` is a high-impact contract. Changes to it can affect Contentful mapping, map rendering, legend generation, analysis behavior, and EE cache behavior.
- The main platform flow currently centers on Contentful `panelLayers`, client-side map state in `MapLayerContext`, and server-side EE URL resolution through `/api/ee`.
- The repository contains both application tests and Storybook coverage; prefer the narrowest relevant test command for the slice you change.

## Repository Structure

- `src/app/`: Next.js app routes and API routes.
- `src/components/`: UI components, map components, contexts, and side panel flows.
- `src/repositories/`: data access for Contentful-backed content.
- `src/services/`: client-side service helpers such as EE URL fetching.
- `src/utils/`: shared types and helpers, including `imageData` and analysis helpers.
- `__tests__/`: focused Vitest coverage for map, analysis, EE cache behavior, and UI components.

## Security

- Do not commit secrets, tokens, or Earth Engine credentials.
- Keep agent-facing documentation limited to operational behavior, invariants, and safe integration details.
