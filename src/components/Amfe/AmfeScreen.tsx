"use client";

import { useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import MapComponent from "@/components/Map/MapComponent";
import { CLASSIFICATION_MIN_ZOOM } from "@/components/Map/classificationLayers";
import type { MunicipalityClassification } from "@/components/Map/classificationLayers";
import {
  geoBrasilSource,
  resolveSpatialFocusBounds,
} from "@/components/Map/mapBounds";
import { useSpatialBoundaryOverlay } from "@/components/PlatformMap/useSpatialBoundaryOverlay";
import { BRAZIL_TERRITORY_CODE } from "@/components/Map/stateSelection";
import { getAllowedStateUfs } from "@/utils/interestAreaStates";
import { DEFAULT_SPATIAL_SELECTION } from "@/utils/spatialScope";
import { toSpatialSelection } from "@/utils/amfeSpatialSelection";
import type { AnalyzePayload } from "@/utils/amfeInterfaces";
import useCities from "./useCities";
import useCitiesOverview from "./useCitiesOverview";
import AnalyzeForm from "./AnalyzeForm/AnalyzeForm";
import { AmfeMapLegend } from "./AmfeMapLegend";
import { AmfeMapDownloadMenu } from "./AmfeMapDownloadMenu";

const BRAZIL_CENTER: [number, number] = [-15.749997, -47.9499962];

const INITIAL_ZOOM = 4;
const MIN_ZOOM = 3;


export const AmfeScreen = () => {
  const t = useTranslations("Analyze");
  const tMap = useTranslations("Map");
  const locale = useLocale();
  const [formPayload, setFormPayload] = useState<AnalyzePayload | null>(null);
  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  const { cities, excludedCities, coverage, loading, error } =
    useCities(formPayload);

  const spatialSelection = useMemo(
    () => toSpatialSelection(formPayload?.interestArea) ?? DEFAULT_SPATIAL_SELECTION,
    [formPayload?.interestArea],
  );

  const municipalityClassification = useMemo<MunicipalityClassification | null>(
    () => {
      const codes = Object.keys(cities);
      if (codes.length === 0) return null;

      return {
        classificationByCode: Object.fromEntries(
          codes.map((code) => [code, cities[code].classification]),
        ),
        excludedCodes: Object.keys(excludedCities),
      };
    },
    [cities, excludedCities],
  );

  const allowedStateUfs = useMemo(
    () => getAllowedStateUfs(spatialSelection),
    [spatialSelection],
  );

  const { overviewGeoJson } = useCitiesOverview(
    municipalityClassification !== null,
  );

  const isClassificationBelowZoomFloor =
    municipalityClassification !== null &&
    overviewGeoJson === null &&
    zoom < CLASSIFICATION_MIN_ZOOM;

  const { boundaryGeoJson, status: boundaryStatus } =
    useSpatialBoundaryOverlay(spatialSelection);

  const spatialFocusBounds = useMemo(() => {
    if (boundaryStatus === "loading") return null;

    return resolveSpatialFocusBounds(
      geoBrasilSource,
      allowedStateUfs,
      boundaryGeoJson,
    );
  }, [allowedStateUfs, boundaryGeoJson, boundaryStatus]);

  const imageOptions = useMemo(
    () =>
      municipalityClassification && !overviewGeoJson
        ? null
        : {
            classification: municipalityClassification,
            overviewGeoJson,
            boundaryGeoJson,
            allowedStateUfs,
            bounds: spatialFocusBounds,
          },
    [
      allowedStateUfs,
      boundaryGeoJson,
      municipalityClassification,
      overviewGeoJson,
      spatialFocusBounds,
    ],
  );

  return (
    <div className="flex h-full w-full min-h-0">
      <aside className="h-full w-[600px] shrink-0 overflow-y-auto overscroll-contain border-r border-gray-200 bg-[#efefef]">
        <AnalyzeForm setFormPayload={setFormPayload} />
      </aside>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-6">
        {error && !loading && (
          <div className="flex h-64 items-center justify-center">
            <p className="text-center font-medium text-red-600">
              {t("error", { error })}
            </p>
          </div>
        )}

        {!loading && coverage && (
          <p className="mb-2 text-sm text-gray-600">
            <span>{t("coverageLabel")} </span>
            <span className="text-[#989F43]">
              {t("coverageMunicipalities", {
                count: coverage.count.toLocaleString(locale),
                totalCount: coverage.totalCount.toLocaleString(locale),
              })}
            </span>
            {coverage.excludedCount > 0 && (
              <span className="text-red-600">
                {t("omitted", {
                  excludedCount: coverage.excludedCount.toLocaleString(locale),
                })}
              </span>
            )}
          </p>
        )}

        <div className="relative min-h-[520px] w-full flex-1 overflow-hidden rounded-xl border border-neutral-200">
          <MapComponent
            mapMode="platform"
            center={BRAZIL_CENTER}
            zoom={INITIAL_ZOOM}
            minZoom={MIN_ZOOM}
            onZoomChange={setZoom}
            showStatesBorder
            estadoSelecionado={BRAZIL_TERRITORY_CODE}
            allowedStateUfs={allowedStateUfs}
            spatialBoundaryGeoJson={boundaryGeoJson}
            spatialFocusBounds={spatialFocusBounds}
            municipalityClassification={municipalityClassification}
            municipalityOverviewGeoJson={overviewGeoJson}
            className="h-full w-full"
          />

          <AmfeMapDownloadMenu
            cities={cities}
            payload={formPayload}
            imageOptions={imageOptions}
          />

          {municipalityClassification && <AmfeMapLegend />}

          {isClassificationBelowZoomFloor && (
            <p
              role="status"
              className="absolute bottom-4 left-4 z-[1000] max-w-xs rounded-lg bg-white/90 p-3 text-xs text-[#364153] shadow-lg"
            >
              {tMap("zoomInForClassification")}
            </p>
          )}

          {loading && (
            <div className="absolute inset-0 z-[1100] flex flex-col items-center justify-center bg-white/70 backdrop-blur-[1px]">
              <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#f3f3f3] border-t-[#989f43]" />
              <p className="mt-4 text-gray-600">{t("loading")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AmfeScreen;
