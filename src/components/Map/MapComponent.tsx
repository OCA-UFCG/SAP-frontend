"use client";

import dynamic from "next/dynamic";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type Map from "./Map"

const MapComponent = dynamic(() =>  import("./Map"), {
  loading: () => (
    <div>
      <p>A map is loading</p>
    </div>
  ),
  ssr: false,
});

export default MapComponent
