# Architecture

## Update Rule

- This is a living document. Update it on every iteration or prompt that changes architecture, flow, client/server boundaries, naming, or module ownership.
- Whenever the main flow changes, update the affected files in `docs/` in the same iteration.

## Purpose

- Capture the operational architecture of SAP frontend, with emphasis on the Contentful -> sidebar -> map -> analysis flow.

## System Shape

- The project uses Next.js App Router as the main application shell.
- The server is responsible for initial data loading and API routes.
- The client is responsible for map interaction, sidebar state, and the detail screen.
- Contentful is the source of institutional content and platform layers.
- Google Earth Engine generates dynamic tile URLs.
- A local MBTiles file serves vector state boundaries.

## Main Runtime Boundaries

- `src/infrastructure/contentful/client.ts` wraps Contentful GraphQL access with `revalidate: 3600`.
- `src/repositories/platform/panelLayerRepository.ts` and `src/repositories/content/siteContentRepository.ts` transform Contentful responses into UI-ready data.
- `src/components/PlatformLayout/PlatformLayout.tsx` fetches `panelLayers` on the server and injects them into the client application.
- `src/components/MapLayerContext/MapLayerContext.tsx` coordinates global map and analysis state on the client.
- `src/app/api/ee/route.ts` and `src/app/api/ee/services.ts` resolve Earth Engine URLs on the server and cache them in memory.

## Critical Flow

1. The server fetches `panelLayers` from Contentful via `getPanelLayers()`.
2. `PlatformSidebar` receives the list and `ModulesContext` builds the monitoring cards.
3. When a card is activated, the application decides between a local vector layer and an EE layer based on `imageData`.
4. EE layers enter `MapLayerContext`, and `useEarthEngineTileLayer` resolves the active year and calls `/api/ee`.
5. `/api/ee` builds a cache key from layer, year, and visualization signature; when needed it queries Earth Engine and returns `url`.
6. The detail screen reuses the same `panelLayer` for legend data, year options, and the territorial analysis view model.

## Confirmed Invariants

- The default territorial selection is `br`.
- The default year after clearing state or activating a vector layer is `general`.
- For an EE layer, the initial year comes from `getImageDataDefaultYear(imageData)`.
- `panelLayers` are sorted by ascending `panelPosition`, with missing values first.
- Opening the detail screen ensures the chosen layer is active before navigation to `analysis-detail`.

## Agent Notes

- Treat `panelLayer.imageData` as a high-impact contract. Changes there can affect map rendering, legend generation, year resolution, analysis, and EE cache behavior.
- If a prompt changes the confirmed behavior above, this file must be updated in the same iteration.
