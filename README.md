# SEDES Frontend

Frontend application for the SEDES platform, built with Next.js. It is the
public platform for the territorial indices published by the project: an
interactive map, a per-layer analysis panel, automatic municipal reports, a
multicriteria analysis page, an administrative index catalog, and institutional
content. Almost nothing here is hardcoded — Contentful, Google Earth Engine,
Firebase, and Google Docs supply the content.

## Stack Overview

- Next.js App Router
- React 19
- TypeScript
- Tailwind CSS v4
- `next-intl` routing with `pt`, `en`, and `es`
- Contentful GraphQL
- Google Earth Engine
- MapLibre
- Firebase Authentication and Firestore
- Vitest and Storybook

## Prerequisites

- Node.js 22 — pinned by `.nvmrc` and by `engines` in `package.json`
- npm

If you use `nvm`, run:

```bash
nvm install
nvm use
```

## Environment Setup

`env.sample.txt` is the authoritative list of variable names. Use it as the
starting point for local runtime variables.

```bash
cp env.sample.txt .env.local
```

The minimum set to run the platform locally:

- **Contentful** — `CONTENTFUL_SPACE_ID`, `CONTENTFUL_ACCESS_TOKEN`, and
  `CONTENTFUL_ENVIRONMENT` supply every layer, index, and institutional page.
  `CONTENTFUL_MANAGEMENT_TOKEN` is additionally required by the index catalog
  and by the pipeline, because both write back to Contentful.
- **Google Earth Engine** — the server-only `GEE_PRIVATE_KEY` service-account
  JSON backs map tiles and on-demand statistics. `GEE_PROJECT_ID` is only
  required when that JSON does not carry the intended consumer `project_id`.
  That project is also the one whose Earth Engine quota is consumed: usage is
  charged to the project issuing the request, not to the project owning the
  asset being read.
- **Firebase** — the `NEXT_PUBLIC_FIREBASE_*` values drive browser sign-in, and
  the Admin credentials (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`,
  `FIREBASE_PRIVATE_KEY`) drive server-side session verification and telemetry
  ingestion. Every platform route rejects an unauthenticated request, so without
  these the platform does not load at all.
- **Google Docs** — `DOCS_DEFAULT` is the document the municipal report reads
  its text from.
- **`API_BASE_URL`** — the multicriteria analysis backend behind `/api/amfe/*`.

Credentials stay server-side: `GEE_PRIVATE_KEY`, the Firebase Admin key, and the
Contentful Management token are read only from `"server-only"` modules, and the
browser reaches them exclusively through our own API routes. Do not commit
secrets to the repository.

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

Application:

- `npm run dev`: start the development server.
- `npm run build`: regenerate `src/data/municipalAvailabilityIndex.json` from
  Contentful and then build the app.
- `npm run build:app`: build the app only, skipping the Contentful regeneration.
- `npm run generate:municipal-availability`: rebuild the availability index on its own.
- `npm run start`: start the production server.
- `npm run lint`: run ESLint.
- `npm run format`: run Prettier across the repository.

Tests:

- `npm run test`: run all Vitest projects.
- `npm run test:unit`: run the unit test project only — the usual fast check.
- `npm run test:storybook`: run the Storybook test project only.
- `npm run storybook`: start Storybook locally.
- `npm run build-storybook`: build the Storybook bundle.
- `npm run ci:verify`: run the blocking validation contract used by CI/CD
  (availability index, `lint`, unit tests, and the webpack build).

Contentful and Earth Engine tooling:

- `npm run contentful:ensure-index-catalog`: create or update the Contentful
  content model the index catalog depends on.
- `npm run catalog:publish-legacy:dry-run` / `:apply`: report, and then apply,
  the catalog adoption of a legacy layer.

Legacy municipal analysis pipeline:

- `npm run pipeline:drive-csv-json`: download Google Drive CSVs and convert them to partitioned municipal analysis JSON files.
- `npm run pipeline:contentful-municipal-analysis:dry-run-all`: validate what municipal analysis entries would be created or updated in Contentful.
- `npm run pipeline:contentful-municipal-analysis:publish-all`: publish all mapped municipal analysis partitions to Contentful.
- `npm run pipeline:contentful-panel-layer:dry-run-all` / `:publish-all`: the same
  two steps for the `panelLayer.imageData` payloads.
- `npm run pipeline:contentful-report-series:dry-run` / `:publish` /
  `:activate` / `:activate-and-prune`: manage the `municipalReportSeries`
  shards that feed the municipality chart and the report history.
- `npm run pipeline:full-cycle`: run the Drive/CSV conversion, Contentful dry-run or publish, report generation, and optional runtime smoke tests.
- `npm run pipeline:verify`: regenerate local JSON outputs and run concise Contentful dry-run checks.

### Running the production build safely

`next build --webpack` peaks high enough to be OOM-killed on a constrained
machine, and the kill can take the whole WSL or editor session with it. Contain
it instead of running it unbounded:

```bash
systemd-run --user --scope -q -p MemoryMax=4G -p MemorySwapMax=6G \
  env NODE_OPTIONS=--max-old-space-size=3072 npm run build:app
```

### Git hooks

Husky runs the unit tests, `lint-staged`, and ESLint on pre-commit, and
`npx tsc --noEmit` on pre-push. The production build is deliberately **not** in
the pre-push hook: it is already mandatory in CI, and running it on a developer
machine mostly succeeded in getting the editor OOM-killed. A hook that rejects a
commit is the signal to fix the change, not to bypass the gate.

## Platform Routes

Every route is locale-prefixed by `next-intl`, so the real paths are
`/pt/platform`, `/en/platform`, and so on.

- `/platform`: the interactive map and the per-layer analysis panel.
- `/platform?view=catalog`: the administrative index catalog, which publishes v2
  indices straight to Contentful. See `docs/index-catalog.md`.
- `/platform?view=logs`: the usage inspection dashboard.
- `/platform/municipal-report`: the automatic territorial report. Its response
  contract is `docs/municipal-report-api.md`.
- `/platform/amfe`: the multicriteria analysis, which talks to the
  `SAP-analise-multicriterial` backend only through the `/api/amfe/*` proxy
  routes. See `docs/amfe.md`.
- `/platform/logs` and `/platform/telemetry` are redirects to
  `/platform?view=logs`, kept so previously shared links keep working.

Access is enforced in two places. The `logs` and `catalog` views check the
session server-side in the page itself: a visitor without a session cookie is
redirected to `/login`, and a signed-in user outside `LOGS_ALLOWED_EMAILS` gets a
404 instead of the dashboard body. The data behind every screen is gated
independently, at the API routes, which resolve the session cookie and return
401 before doing any work.

## Where Territorial Statistics Come From

There are two paths, and they coexist on purpose:

- **v2 / migrated** — the statistic lives in the Earth Engine asset itself and is
  read on demand by the server, per layer, period, and territory, through
  `panelLayer.statisticsSource`. Nothing is duplicated in Contentful
  (`values: {}`). This is the target architecture and it is in production; new
  indices are published this way, from the index catalog.
- **legacy** — the statistic lives in Contentful `municipalAnalysis` partitions
  produced by the Drive/CSV pipeline described below.

Migrating every asset takes time, so the legacy path is a shrinking surface that
is maintained but not extended, and cannot be deleted while unmigrated indices
depend on it. The `municipalReportSeries` shards and the report availability
index have not been migrated either.

## Legacy Municipal Analysis Pipeline

The CSV-to-Contentful pipeline lives in `tools/drive-contentful-pipeline`.
Its versioned configuration lives in
`tools/drive-contentful-pipeline/config/pipeline-config.json`.
It is used to move Google Earth Engine CSV exports into Contentful
`municipalAnalysis` entries consumed by the platform detail view.

The generated files under `data/contentful-pipeline` are local pipeline output
and must not be committed. `src/data/municipalAvailabilityIndex.json` is also a
generated artifact: `npm run build` recreates it from the municipal analyses
published in Contentful before compiling the application. Without credentials it
falls back to the index already on disk; when there is none either — a clean CI
checkout of a Dependabot or fork pull request, which GitHub runs without the
repository secrets — the CI workflow sets
`ALLOW_PLACEHOLDER_AVAILABILITY_INDEX=true` so an empty placeholder is written
and lint, tests and build can still run. The deploy workflows deliberately leave
that variable unset, so a missing secret fails the release instead of shipping an
empty index.

Typical flow:

```bash
npm run pipeline:drive-csv-json
npm run pipeline:contentful-municipal-analysis:dry-run-all
npm run pipeline:contentful-municipal-analysis:publish-all
```

For repeatable operational runs with a final JSON/Markdown report, use:

```bash
npm run pipeline:full-cycle -- --skip-download
```

Add `--publish` to write and publish to Contentful, and add
`--runtime-base-url` plus `--session-cookie-env` to smoke-test published
`/api/municipal-analysis/[panelLayerId]?year=<yearKey>` routes.

Use `npm run pipeline:drive-csv-json -- --skip-download` when the CSVs already
exist locally and only the partitioned JSONs need to be regenerated.

See `tools/drive-contentful-pipeline/README.md` for the full command contract,
environment variables, mapping rules, partitioning behavior, and Contentful
publication details.

The publish dry-run is the required safety check before writing to Contentful.
It validates the manifest, rejects ambiguous partitions that the runtime route
could not distinguish by `panelLayerId` and `year`, and verifies that compressed
`imageData` payloads can be decompressed back to `territorial-compact` data.

At runtime, `/platform` does not load every `municipalAnalysis` entry upfront.
The analysis panel lazy-loads municipal data by layer and selected period
through `/api/municipal-analysis/[panelLayerId]?year=<yearKey>`. That server
route fetches the needed Contentful partition, decompresses and merges it with
the matching `panelLayer` year, and keeps the result in a per-process in-memory
cache for 10 minutes by default. If a refresh fails after the TTL, the cache can
serve the expired value for that key while the next request tries Contentful
again. The route still supports requests without `year` as a compatibility
fallback, but the client should use period-scoped requests.
The municipality chart loads its complete history separately through
`/api/municipal-analysis/[panelLayerId]/series?locationKey=<code>`. The server
reads one `municipalReportSeries` shard and returns only the selected
municipality, so the period request remains small and independent from the
temporal series.

Static GEE migration layers and catalog v2 layers add
`locationKey=<territory>` to the period endpoint so the server reads only the
requested Brazil, state, municipality, region, biome, ASD, or semiarid row from
the FeatureCollection. Their complete temporal chart is assembled from these
narrow period responses; they do not create `municipalReportSeries`. Carbon and
ANA retain a temporary Contentful fallback. Dynamic catalog sources use stale
cache on a GEE refresh failure and otherwise report unavailability; they never
duplicate statistics in Contentful. GEE results are cached per layer, period,
and territory for 10 minutes by default. Requests without `locationKey` remain
supported for legacy Contentful partitions.
Set `MUNICIPAL_ANALYSIS_CACHE_TTL_SECONDS` or
`MUNICIPAL_ANALYSIS_CACHE_MAX_ENTRIES` to tune that behavior.
The endpoint is protected server-side and returns private HTTP cache headers;
only the server-side in-memory cache is shared across authenticated requests in
the same Node process.

## Google Docs Report Templates

O interpretador de relatórios monta o conteúdo final do documento a partir de
templates armazenados no Google Docs. A saída atual segue este formato:

```ts
{
  DROUGHT_MONITOR: [
    { title: "Situação atual", text: "Texto preenchido da situação atual." },
    { title: "Tendência recente", text: "Texto preenchido da tendência." },
    { title: "Contexto histórico", text: "Texto preenchido do histórico." },
  ],
}
```

Nesse formato, cada chave representa um tema disponível para geração do
documento. Todos os temas são lidos de um único documento configurado no
`.env`:

```env
DOCS_DEFAULT=https://docs.google.com/document/d/.../export?format=txt
```

O documento deve separar cada template pelo título do layer, por exemplo
`◉ 1. Monitor de Secas`, `◈ 2. Índice de Aridez` e
`◆ 3. Índice de Degradação da Terra`. O interpretador recorta cada bloco pelo
título configurado para o tema e ignora as seções de notas metodológicas.

O texto exportado de cada tema fica em cache na memória do processo por 10
minutos. Depois desse prazo, a próxima geração tenta atualizar o conteúdo no
Google Docs. Se a atualização falhar e já existir uma versão anterior, essa
última versão é usada para que o relatório continue disponível. Em ambientes
com mais de uma instância, cada processo mantém seu próprio cache.

A partir desse documento, o interpretador lê o conteúdo, identifica cada seção
marcada como `*Título*` ou `**Título**` e converte cada seção em um bloco:

```ts
{
  title: "Título da seção",
  text: "Texto da seção com os dados já preenchidos"
}
```

O fluxo atual é:

```txt
temas -> DOCS_DEFAULT -> cache -> seções por layer -> texto preenchido
```

Assim, a equipe pode editar todos os textos em um só lugar, mantendo uma seção
por layer. O tema é o próprio `panelLayer.id`, e a seção do documento é
encontrada pelo **título** do layer — não existe campo `docsTheme`. Para incluir
um novo layer no relatório basta criar no documento uma seção cujo título
corresponda ao título do layer.

Um índice publicado pelo catálogo tem uma alternativa: o campo
`panelLayer.reportConfig`, escrito na seção "Relatório Automático" do formulário,
substitui o bloco do documento daquele índice. Ver `docs/index-catalog.md`.

## Reference Docs

Reference documentation lives under `docs/`. Read the relevant file instead of
re-deriving its content:

- `docs/image-data-contract.md`: executable `panelLayer.imageData` contract, including `territorial-compact` v1, municipal patches, compressed envelopes, and legacy read compatibility.
- `docs/gee-statistics.md`: on-demand GEE FeatureCollection statistics, source registry, fallback, and rollout.
- `docs/index-catalog.md`: the administrative catalog that publishes v2 indices, what it writes to Contentful, and its access rules.
- `docs/municipal-report-api.md`: the `MunicipalReportData` v1 response contract and its territorial keys.
- `docs/amfe.md`: multicriteria analysis page, backend proxy routes, and the map choropleth contract.
- `docs/mcp-servers.md`: the MCP servers declared in `.mcp.json` and what each is for.
- `tools/drive-contentful-pipeline/README.md`: the full legacy pipeline command contract.
- `rules.md`: the code style, comment, testing, and dependency rules this repository follows.

These files are living documents. If a code change affects a contract, the
Contentful schema, Earth Engine behavior, or another operational assumption, the
affected file must be updated in the same iteration.

## Development Notes

- `panelLayer.imageData` is a high-impact contract. Changes to it can affect Contentful mapping, map rendering, legend generation, analysis behavior, and EE cache behavior.
- The main platform flow currently centers on Contentful `panelLayers`, client-side map state in `MapLayerContext`, and server-side EE URL resolution through `/api/ee`.
- Every `/api` platform route resolves the Firebase session cookie before doing
  work. Verification is cached per cookie for a short window
  (`SESSION_VERIFICATION_CACHE_TTL_SECONDS`) because checking revocation costs a
  round-trip to the Identity Toolkit on every route. A failed verification is
  never cached, and the entry never outlives the token's own expiry. Shorten the
  TTL if that window becomes unacceptable; do not drop the revocation check to
  buy latency.
- Every server-side cache here must also deduplicate in-flight loads, not just
  store results. A cold start or an expiring TTL puts many simultaneous users on
  the same miss, and without dedupe that becomes one Earth Engine or Contentful
  call per user.
- UI logs for municipality/state search and layer usage are ingested through `/api/logs` and stored in Firestore via `firebase-admin`. The route accepts append-only event batches for `search_found`, `search_not_found`, `layer_toggled`, and `layer_details_opened`.
- Search telemetry is recorded for the home search bar and the analysis panel search bar. Layer telemetry is recorded from `ModulesContext` when a layer is toggled or when the detail view is opened.
- `search_found` e `search_not_found` carregam sempre `activeLayerId` e `activeDateLabel`, para distinguir a mesma consulta entre camadas e datas diferentes.
- Anonymous traffic is tagged with a browser-local session id; authenticated traffic also carries the Firebase session `uid` resolved on the server.
- `FIREBASE_TELEMETRY_COLLECTION` defaults to `telemetry-events-local`; set explicit non-local values such as `telemetry-events-beta` and `telemetry-events-prod` to avoid mixing logs across environments.
- This repository's deploy workflows read `FIREBASE_TELEMETRY_COLLECTION_BETA` and `FIREBASE_TELEMETRY_COLLECTION_PROD` GitHub variables for the runtime container env.
- Set `LOGS_ALLOWED_EMAILS` to a comma-separated list of normalized emails allowed to view `/platform?view=logs` and the index catalog.
- `/api/logs` remains the canonical append-only ingestion endpoint for log events.
- The repository contains both application tests and Storybook coverage; prefer the narrowest relevant test command for the slice you change.
- CI/CD blocks merges and releases on `npm run ci:verify`; broader Storybook/browser coverage remains a separate, non-blocking path.
- O catálogo administrativo de índices usa a allowlist `LOGS_ALLOWED_EMAILS` e o
  token server-side do Contentful Management. Suas mutações exigem também
  same-origin e `Idempotency-Key`. Ele não lê o Google Drive nem gera CSV: os
  valores territoriais ficam no asset do Earth Engine.
- As rotas de proxy `/api/amfe/*` exigem `API_BASE_URL` no runtime; os deploys
  leem `API_BASE_URL_BETA`, `API_BASE_URL_GAMMA` e `API_BASE_URL`.

## Telemetry Validation

Use the focused unit tests below when touching the telemetry slice:

- `npm run test:unit -- --run __tests__/telemetryRoute.test.ts`
- `npm run test:unit -- --run __tests__/SearchBar.test.tsx __tests__/SearchBarPlatform.test.tsx __tests__/AnalysisContext.test.tsx __tests__/ModulesContext.test.tsx`

With Firebase Admin credentials configured, manual verification should confirm that `/api/logs` receives events from the home search, analysis search, layer toggles, and layer detail openings, and that documents are written to the configured Firestore collection.

## Repository Structure

Domain rules belong in `src/utils`, `src/contracts`, and `src/repositories` —
never inline in a page or a component.

- `src/app/`: Next.js app routes and API routes.
- `src/components/`: UI components, map components, contexts, and side panel flows.
- `src/contracts/`: versioned, executable contracts shared by the app and the
  pipeline. Written as `.mjs` where Node tooling has to import them, so the two
  can never drift. Start here before inventing a shape.
- `src/repositories/`: the only place that talks to Contentful or Earth Engine
  for platform data, including the in-memory caches.
- `src/services/`: report building, chart rendering, and catalog logic.
- `src/infrastructure/`: the SDK adapters owned by this project — Contentful
  GraphQL and Earth Engine.
- `src/lib/`: Firebase client and admin, server session, access checks, and geo helpers.
- `src/config/`: static per-layer registries, such as the municipal report layers.
- `src/translations/`: `next-intl` routing and the `pt`, `en`, and `es` dictionaries.
- `src/utils/`: shared types and helpers, including `imageData` and analysis helpers.
- `src/data/`: generated artifacts, not source.
- `__tests__/`: focused Vitest coverage for map, analysis, EE cache behavior, and UI components.
- `tools/`: the legacy Drive/Contentful pipeline and the Contentful maintenance scripts.
- `docs/`: the reference documentation listed above.

## Security

- Do not commit secrets, tokens, or Earth Engine credentials.
- Keep agent-facing documentation limited to operational behavior, invariants, and safe integration details.
