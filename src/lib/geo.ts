import type { FeatureCollection, Geometry } from "geojson";
import { normalize } from "@/utils/functions";
import citiesIndex from "@/data/citiesIndex.json";

export interface CDIFeatureProperties {
  classe_cdi: number;
  first: number;
  [key: string]: unknown;
}

export type CDIVectorData = FeatureCollection<Geometry, CDIFeatureProperties>;

export interface CitySearchResult {
  code: string;
  label: string;
  name: string;
  uf: string;
}

export type StateSearchResult =
  | { type: "uf"; key: string }
  | { type: "city"; key: string; city: CitySearchResult }
  | { type: "br"; key: "br" };

export function resolveStateKeyFromSearch(
  query: string,
  statesObj: Record<string, string>,
): StateSearchResult {
  const normalizedQuery = normalize(query.trim());

  if (!normalizedQuery) {
    return { type: "br", key: "br" };
  }

  const foundByUf = Object.keys(statesObj).find(
    (uf) => normalize(uf) === normalizedQuery,
  );

  if (foundByUf) {
    return { type: "uf", key: foundByUf };
  }

  const foundByName = Object.entries(statesObj).find(
    ([, name]) => normalize(name) === normalizedQuery,
  );

  if (foundByName) {
    return { type: "uf", key: foundByName[0] };
  }

  const foundByCity = citiesIndex.find((city) => {
    return (
      normalize(city.label) === normalizedQuery ||
      normalize(city.name) === normalizedQuery
    );
  });

  if (foundByCity) {
    return {
      type: "city",
      key: foundByCity.uf,
      city: foundByCity,
    };
  }

  return { type: "br", key: "br" };
}
