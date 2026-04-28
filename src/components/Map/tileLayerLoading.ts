import type { MapSourceDataEvent } from "maplibre-gl";

type TileLayerReadyEvent = Pick<
  MapSourceDataEvent,
  "isSourceLoaded" | "sourceDataType" | "sourceId" | "tile"
>;

export function isTileLayerReadyEvent(
  event: TileLayerReadyEvent,
  sourceId: string,
): boolean {
  if (event.sourceId !== sourceId) {
    return false;
  }

  // A tile-attached source event is the closest signal to the first visible
  // raster response. Some runtimes don't emit that shape consistently, so keep
  // `idle` as a terminal fallback.
  if (Boolean(event.tile)) {
    return true;
  }

  return event.sourceDataType === "idle" && event.isSourceLoaded;
}
