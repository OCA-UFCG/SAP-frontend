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

For map features backed by Google Earth Engine and for server-side telemetry ingestion, Firebase Admin credentials must also be configured in the runtime environment. Do not commit secrets to the repository.

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
- `npm run ci:verify`: run the blocking validation contract used by CI/CD (`lint`, unit tests, and webpack build).
- `npm run start`: start the production server.
- `npm run lint`: run ESLint.
- `npm run test`: run all Vitest projects.
- `npm run test:unit`: run the unit test project only.
- `npm run test:storybook`: run the Storybook test project only.
- `npm run storybook`: start Storybook locally.
- `npm run build-storybook`: build the Storybook bundle.
- `npm run pipeline:drive-csv-json`: download Google Drive CSVs and convert them to partitioned municipal analysis JSON files.
- `npm run pipeline:contentful-municipal-analysis:dry-run-all`: validate what municipal analysis entries would be created or updated in Contentful.
- `npm run pipeline:contentful-municipal-analysis:publish-all`: publish all mapped municipal analysis partitions to Contentful.
- `npm run format`: run Prettier across the repository.

## Municipal Analysis Pipeline

The CSV-to-Contentful pipeline lives in `tools/drive-contentful-pipeline`.
It is used to move Google Earth Engine CSV exports into Contentful
`municipalAnalysis` entries consumed by the platform detail view.

The generated files under `data/contentful-pipeline` are local pipeline output
and must not be committed. The source-controlled part is the tooling and the
shared municipality index used by the app.

Typical flow:

```bash
npm run pipeline:drive-csv-json
npm run pipeline:contentful-municipal-analysis:dry-run-all
npm run pipeline:contentful-municipal-analysis:publish-all
```

Use `npm run pipeline:drive-csv-json -- --skip-download` when the CSVs already
exist locally and only the partitioned JSONs need to be regenerated.

See `tools/drive-contentful-pipeline/README.md` for the full command contract,
environment variables, mapping rules, partitioning behavior, and Contentful
publication details.

At runtime, `/platform` does not load every `municipalAnalysis` entry upfront.
The analysis panel lazy-loads one layer through
`/api/municipal-analysis/[panelLayerId]`. That server route fetches the needed
Contentful data, decompresses and merges it with the matching `panelLayer`, and
keeps the result in a per-process in-memory cache for 10 minutes by default.
Set `MUNICIPAL_ANALYSIS_CACHE_TTL_SECONDS` or
`MUNICIPAL_ANALYSIS_CACHE_MAX_ENTRIES` to tune that behavior.

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
- UI logs for municipality/state search and layer usage are ingested through `/api/logs` and stored in Firestore via `firebase-admin`. The route accepts append-only event batches for `search_found`, `search_not_found`, `layer_toggled`, and `layer_details_opened`.
- Search telemetry is recorded for the home search bar and the analysis panel search bar. Layer telemetry is recorded from `ModulesContext` when a layer is toggled or when the detail view is opened.
- `search_found` e `search_not_found` carregam sempre `activeLayerId` e `activeDateLabel`, para distinguir a mesma consulta entre camadas e datas diferentes.
- Anonymous traffic is tagged with a browser-local session id; authenticated traffic also carries the Firebase session `uid` resolved on the server.
- `FIREBASE_TELEMETRY_COLLECTION` defaults to `telemetry-events-local`; set explicit non-local values such as `telemetry-events-beta` and `telemetry-events-prod` to avoid mixing logs across environments.
- This repository's deploy workflows read `FIREBASE_TELEMETRY_COLLECTION_BETA` and `FIREBASE_TELEMETRY_COLLECTION_PROD` GitHub variables for the runtime container env.
- Set `LOGS_ALLOWED_EMAILS` to a comma-separated list of normalized emails allowed to view `/platform/logs`.
- The inspection page at `/platform/logs` is protected server-side: unauthenticated users are redirected to `/login`, and authenticated users outside `LOGS_ALLOWED_EMAILS` do not receive the dashboard response.
- `/api/logs` remains the canonical append-only ingestion endpoint for log events.
- The repository contains both application tests and Storybook coverage; prefer the narrowest relevant test command for the slice you change.
- CI/CD blocks merges and releases on `npm run ci:verify`; broader Storybook/browser coverage remains a separate, non-blocking path.

## Telemetry Validation

Use the focused unit tests below when touching the telemetry slice:

- `npm run test:unit -- --run __tests__/telemetryRoute.test.ts`
- `npm run test:unit -- --run __tests__/SearchBar.test.tsx __tests__/SearchBarPlatform.test.tsx __tests__/AnalysisContext.test.tsx __tests__/ModulesContext.test.tsx`

With Firebase Admin credentials configured, manual verification should confirm that `/api/logs` receives events from the home search, analysis search, layer toggles, and layer detail openings, and that documents are written to the configured Firestore collection.

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
