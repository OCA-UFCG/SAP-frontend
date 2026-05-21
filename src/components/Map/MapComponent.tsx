"use client";

import dynamic from "next/dynamic";
import type { MapProps } from "./Map";

const MapComponent = dynamic<MapProps>(
  () => import("./Map").then((mod) => mod.default),
  {
    loading: () => (
      <div>
        <p>A map is loading</p>
      </div>
    ),
    ssr: false,
  },
);

export default MapComponent;
