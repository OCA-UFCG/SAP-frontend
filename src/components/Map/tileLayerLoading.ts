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

  // Pronta é quando o último bloco da vista chegou, não o primeiro: com o
  // primeiro, o aviso sumia e o Brasil ainda aparecia em blocos por um ou dois
  // segundos. O evento de cada bloco traz `isSourceLoaded`, que só fica
  // verdadeiro quando não falta nenhum (bloco com erro também conta como
  // resolvido). Alguns runtimes não emitem esse formato sempre, então `idle`
  // continua como saída final.
  if (Boolean(event.tile)) {
    return event.isSourceLoaded;
  }

  return event.sourceDataType === "idle" && event.isSourceLoaded;
}
