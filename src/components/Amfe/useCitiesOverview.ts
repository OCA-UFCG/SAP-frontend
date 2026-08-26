"use client";

import { useEffect, useState } from "react";
import type { MunicipalityOverviewGeoJson } from "@/components/Map/classificationLayers";

export const CITIES_OVERVIEW_URL = "/data/brazil-cities-overview.json";

const fetchCitiesOverview = async () => {
  const response = await fetch(CITIES_OVERVIEW_URL);

  if (!response.ok) {
    throw new Error(`Overview request failed with ${response.status}`);
  }

  return response.json() as Promise<MunicipalityOverviewGeoJson>;
};

const useCitiesOverview = (enabled: boolean) => {
  const [overviewGeoJson, setOverviewGeoJson] =
    useState<MunicipalityOverviewGeoJson | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || overviewGeoJson) return;

    let cancelled = false;

    fetchCitiesOverview()
      .then((data) => {
        if (!cancelled) setOverviewGeoJson(data);
      })
      .catch((reason) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : "Unknown error");
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, overviewGeoJson]);

  return { overviewGeoJson, error };
};

export default useCitiesOverview;
