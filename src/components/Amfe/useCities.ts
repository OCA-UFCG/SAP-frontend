"use client";

import { useEffect, useState } from "react";
import {
  AnalysisCoverage,
  AnalyzePayload,
  Cities,
  ExcludedCities,
} from "@/utils/amfeInterfaces";
import { getErrorMessage } from "@/utils/getErrorMessage";

const useCities = (payload: AnalyzePayload | null) => {
  const [cities, setCities] = useState<Cities>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<AnalysisCoverage | null>(null);
  const [excludedCities, setExcludedCities] = useState<ExcludedCities>({});

  useEffect(() => {
    if (!payload) return;

    let cancelled = false;
    const controller = new AbortController();

    const fetchCities = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/amfe/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        const data = await response.json();
        if (cancelled) return;

        if (!response.ok) throw new Error(getErrorMessage(data));

        setCities(data.result || data);
        setExcludedCities(data.excluded || {});
        setCoverage({
          count: data.count ?? Object.keys(data.result || data).length,
          totalCount: data.total_count ?? data.count ?? 0,
          excludedCount: data.excluded_count ?? 0,
        });
      } catch (err) {
        if (cancelled || (err instanceof Error && err.name === "AbortError")) {
          return;
        }

        setCities({});
        setExcludedCities({});
        setCoverage(null);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchCities();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [payload]);

  return { cities, excludedCities, coverage, loading, error };
};

export default useCities;
