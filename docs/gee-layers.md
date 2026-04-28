# GEE Layers

## Update Rule

- This is a living document. Update it on every iteration or prompt that changes EE payloads, legend rules, cache behavior, warmup behavior, band selection, `imageData` typing, or rendering behavior.
- If a prompt changes the EE pipeline, update this file before considering the task complete.

## Purpose

- Explain how an EE layer starts in Contentful, becomes a client request, passes through the backend, and returns as a tile URL ready for rendering.

## Source of Truth Today

- The best current source of truth for agents is the `panelLayer.imageData` contract together with the pipeline implemented in `src/utils/imageData.ts`, `src/services/mapServices.ts`, and `src/app/api/ee/*`.

## End-to-End Flow

1. Contentful provides `imageData`, `minScale`, and `maxScale` inside `panelLayer`.
2. The client resolves the active year via `resolveImageYearEntry()` and sends `imageId`, `imageParams`, `minScale`, and `maxScale` to `POST /api/ee?name=<layer>&year=<year>`.
3. The route validates the payload, builds a versioned cache key, and tries to serve an already cached URL.
4. If there is no valid cache entry, the backend authenticates with EE, resolves the asset, generates the map id, and returns `url`.

## Layer Types

- Local vector layers, such as `CDI`, do not use this pipeline. They are activated through local data registered in `DATASET_REGISTRY`.
- EE layers use `imageData` and are treated as `IEEInfo` at activation time.

## Visualization Rules

- If any `imageParams` item has `pixelLimit`, the layer is treated as categorical.
- For categorical layers, the backend remaps pixels to `1..N` and uses `min=1` and `max=<number of classes>`.
- For categorical layers, Contentful `minScale` and `maxScale` must not control final visualization.
- If there is no `pixelLimit`, the layer is continuous and uses `minScale ?? 0` and `maxScale ?? 1`.
- The backend applies `selfMask()` before generating the map id.
- For `ImageCollection`, the backend calls `mosaic()` and reapplies the projection from the first collection item.
- The current implementation selects the last available band from the asset before rendering.

## Cache and Warmup

- The cache key includes `name`, `year`, `imageId`, `imageParams`, `minScale`, and `maxScale`.
- The current cache key format version is `v3`.
- In-memory TTL is 30 minutes.
- Expired entries are evicted on demand.
- Warmup starts on the first `/api/ee` request and schedules recaching every 12 hours.
- Even when a cache entry exists, the route still validates the incoming payload before responding.

## Agent Notes

- Changing `imageParams`, `pixelLimit`, `minScale`, or `maxScale` is both a visual behavior change and a cache behavior change.
- Adding a new `imageData` format also requires updates to `docs/analysis-contract.md` and the corresponding EE/cache tests.
- This file must evolve on each relevant iteration so agents do not rely on stale assumptions.

## Security

- Do not document the real GEE private key.
- Record only the requirement for `GEE_PRIVATE_KEY` in the server environment.
