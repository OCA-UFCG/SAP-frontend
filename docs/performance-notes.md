# Performance Notes

## Update Rule

- This is a living document. Update it on every iteration or prompt that changes state distribution, React context design, payload size or shape, EE cache behavior, memoization strategy, or map/sidebar rendering behavior.
- If an iteration touches performance-sensitive code, review this file in the same prompt.

## Purpose

- Record known bottlenecks and the decisions in place to avoid regressions in the sidebar, map, EE cache, and analysis mapping.

## Current Hotspots

- The sidebar is sensitive to unnecessary rerenders when global map state fans out too broadly.
- Large `panelLayer.imageData` payloads and large territorial analysis payloads increase network, parse, and render cost.
- Recomputing Earth Engine URLs for the same configuration is expensive and should be amortized by cache.
- Territorial ranking cost grows with the number of classes and locations; naive implementations scale poorly.

## Confirmed Guardrails

- `MapLayerContext` is split into three contexts: `actions`, `active state`, and `view state`, to avoid rerendering the whole sidebar on changes such as `selectedState`.
- `ModulesContext` builds a lightweight dataset for cards and uses `memo` in `LayerDatasetCard`, which avoids passing heavy `PanelLayerI` objects into every card render.
- EE cache uses the full visualization signature, including `imageId`, `imageParams`, `minScale`, and `maxScale`, to prevent collisions between visually different configurations.
- Ranking generation in `analysis.mappers.ts` was reduced to a primary pass over year values, which matters when embedded JSON becomes large.
- `valuesScale` is an important strategy for compacting percentage payloads without losing UI meaning.

## Practical Rules

- If a component only needs active-layer or selected-year data, prefer the narrow hooks `useMapLayerActiveState`, `useMapLayerViewState`, and `useMapLayerActions` instead of the full `useMapLayer()` hook.
- Do not widen sidebar card props with heavy objects unless the impact has been measured.
- If you change the EE cache key, update the cache tests and route behavior tests as part of the same change.
- If you expand `imageData`, reevaluate serialization, hydration, and parse cost before shipping.

## Regression Symptoms

- Changing the selected state rerenders all monitoring cards.
- Switching between years or layers triggers repeated EE lookups for the same configuration.
- Opening the detail screen becomes noticeably slow with large compact payloads.
- Small changes in legend or schema invalidate too much cache or too little cache.

## Validation Targets

- When touching analysis performance, review `__tests__/analysis.mappers.test.ts`.
- When touching EE cache behavior, review `__tests__/ee-cache.test.ts` and `__tests__/ee-route.cache-behavior.test.ts`.
- When touching context distribution or sidebar rendering, validate that `selectedState` changes do not trigger unnecessary cascading rerenders.

## Maintenance Reminder

- These notes are not static history. They must evolve with each relevant iteration so agents do not operate on stale assumptions.
