# Analysis Contract

## Update Rule

- This is a living document. Update it on every iteration or prompt that changes the `imageData` shape, year or location fallback rules, ranking semantics, required or optional fields, or legacy compatibility.
- If a prompt changes this contract, update this file in the same iteration.

## Purpose

- Define the contract the UI uses to build distribution, highlight, summary text, and territorial ranking in the detail screen.

## Canonical Shape Today

- The frontend prefers top-level compact `imageData`.
- The current canonical shape is `CompactTerritorialAnalysisDataset`.

```json
{
  "schemaVersion": 1,
  "type": "territorial-compact",
  "defaultYear": "2024",
  "classes": [
    {
      "id": "moderate",
      "label": "Moderate",
      "color": "#F0C419",
      "tone": {
        "color": "#7A5A00",
        "bg": "rgba(240,196,25,0.16)",
        "border": "rgba(240,196,25,0.4)"
      },
      "pixelLimit": 20
    }
  ],
  "locations": {
    "br": "Brazil"
  },
  "templates": {
    "country": "In Brazil, class {label} dominates {value}% of the analyzed area.",
    "state": "In {name}, class {label} dominates {value}% of the analyzed area.",
    "highlight": "Mostly {label} region"
  },
  "ranking": {
    "title": "States by classification",
    "totalLabel": "States"
  },
  "years": {
    "2024": {
      "imageId": "projects/example/image",
      "year": "2024",
      "valuesScale": 10,
      "values": {
        "br": [321, 279],
        "ac": [410, 190]
      }
    }
  }
}
```

## Required vs Optional

- Required in compact format: `schemaVersion`, `type = territorial-compact`, `classes`, `years`, `years[year].imageId`, and `years[year].values`.
- Optional: `defaultYear`, `locations`, `templates`, `ranking`, `years[year].year`, `years[year].valuesScale`, `classes[].tone`, and `classes[].pixelLimit`.

## Semantic Rules

- The order of `values` must match the order of `classes` exactly.
- If `valuesScale` exists, the UI divides each value by that scale before displaying percentages.
- `defaultYear` is honored only if it exists in `years`; otherwise the UI uses the first ordered year.
- If the active year does not exist for the layer, the UI falls back to the effective default year.
- The location name comes from `locations[locationKey]`; fallback behavior is `br -> Brasil`, any other key -> raw key.
- Ranking is produced only when `selectedState === br`.
- Each ranking group shows the top 5 positive values for its class.
- `total` counts how many states have that class as dominant.
- If no `values` exist for a year/location combination, the analysis result is null and the UI must show an empty state.
- If `templates` is missing, the frontend falls back to hardcoded default strings defined in `analysis.mappers.ts`.

## Legacy Compatibility

- The code still accepts legacy year-indexed `imageData`, where each year entry can carry `analysis.data` in the same compact format.
- In the legacy shape, the default year can come from `default: true`; if absent, the UI prefers `general` and then the first ordered year.
- For new data, prefer the top-level compact format and avoid expanding the legacy shape.

## Consumers

- The confirmed consumer documented here is the frontend detail screen: `analysis.mappers.ts`, `AnalysisContext.tsx`, and `AnalysisPanel`.
- No other consumers have been explicitly documented by the team yet.

## Agent Notes

- Changes to this contract require review of legend generation, year options, template text behavior, empty-state behavior, and `analysis.mappers` tests.
- This file must stay aligned with the code on every relevant iteration.
