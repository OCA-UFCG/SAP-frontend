"use client";

import dynamic from "next/dynamic";

const MapComponent = dynamic(() => import("./Map"), {
  loading: () => (
    <div>
      <p>A map is loading</p>
    </div>
  ),
  ssr: false,
});

export default MapComponent;
