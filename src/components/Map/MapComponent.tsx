"use client";

import dynamic from "next/dynamic";
import type { MapProps } from "./Map";

import { useTranslations } from "next-intl";

const MapLoading = () => {
  const t = useTranslations("MapComponent");
  return (
    <div>
      <p>{t("loading")}</p>
    </div>
  );
};

const MapComponent = dynamic<MapProps>(
  () => import("./Map").then((mod) => mod.default),
  {
    loading: MapLoading,
    ssr: false,
  },
);

export default MapComponent;
