# Contentful Schema

## Update Rule

- This is a living document. Update it on every iteration or prompt that changes GraphQL queries, schema, ownership, revalidation behavior, UI-consumed fields, or content fallbacks.
- Any `panelLayer` change must be reflected here in the same iteration.

## Purpose

- Centralize the operational Contentful context so agents can quickly identify what is institutional, what powers the platform, and what breaks when the schema changes.

## Current Access Pattern

- Access goes through `src/infrastructure/contentful/client.ts`, which uses GraphQL, `fetch`, `Authorization: Bearer <token>`, and `next: { revalidate: 3600 }`.
- The client supports `CONTENTFUL_PREVIEW` with fallback to `NEXT_PUBLIC_*` variables.
- The default Contentful environment is `master`.

## High-Impact Content Types

- `panelLayer` is the most critical content type for the platform.
- `panelLayer` defines sidebar cards and provides the `imageData` used both for EE visualization and the detail screen.
- `footer`, `banner`, `secaoSobre`, `about`, `cabealhoSees`, and `partners` power the institutional experience and carry lower risk than `panelLayer`.

## Current `panelLayer` Contract

- Fields currently queried: `sys.id`, `name`, `id`, `description`, `panelPosition`, `previewMap { url title width height }`, `imageData`, `minScale`, and `maxScale`.
- The most critical field is `imageData`.
- `imageData` concentrates legend data, year data, EE asset references, and in some formats the embedded territorial analysis payload.

## Failure Modes

- If Contentful returns GraphQL errors or missing `data`, `getContent()` throws.
- `getPanelLayers()` catches that error and returns `[]`.
- The visible effect is that monitoring cards disappear from the platform sidebar.
- Removing schema fields without updating `panelLayerRepository.ts` creates schema/query drift.

## Change Protocol

- Every `panelLayer` change must be accompanied by updates to the GraphQL query, TypeScript interfaces, and downstream consumers in map, sidebar, and analysis code.
- If the `imageData` format changes, update `src/utils/interfaces.ts`, `src/utils/imageData.ts`, `src/components/analysis/analysis.mappers.ts`, and related tests together.
- For agents, the safe assumption is that schema changes in `panelLayer` are breaking changes unless proven otherwise.

## Ownership and Open Questions

- The team has not yet documented who approves Contentful schema changes.
- Until that is defined, treat schema updates as coordinated decisions between frontend and whoever operates the CMS.

## Security

- Do not document tokens, real secret values, or credential details.
- Record only variable names and expected behavior.
