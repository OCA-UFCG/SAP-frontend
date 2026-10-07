import type {
  MapGeoJSONFeature,
  Map as MaplibreMap,
  PointLike,
} from "maplibre-gl";
import { SPATIAL_VALUE_OPTIONS } from "@/utils/spatialScope";
import { getStateBiomes } from "@/utils/interestAreaStates";
import { SPATIAL_BOUNDARY_FILL_LAYER_ID } from "./mapDefinitions";

const BIOME_VALUES = new Set(
  SPATIAL_VALUE_OPTIONS.biome.map((option) => option.value),
);

/** Bioma desenhado no topo do ponto, ignorando features fora do seletor. */
const findRenderedBiome = (
  map: MaplibreMap,
  point: PointLike,
): string | undefined => {
  if (!map.getLayer(SPATIAL_BOUNDARY_FILL_LAYER_ID)) return undefined;

  const features = map.queryRenderedFeatures(point, {
    layers: [SPATIAL_BOUNDARY_FILL_LAYER_ID],
  }) as MapGeoJSONFeature[];

  const biomeFeature = features.find((feature) => {
    const name = feature.properties?.name;
    return typeof name === "string" && BIOME_VALUES.has(name);
  });

  return biomeFeature?.properties?.name as string | undefined;
};

/**
 * Bioma sob o cursor, pela mesma regra para o balão de hover e para o clique.
 *
 * Enquanto hover e clique resolviam o bioma cada um do seu jeito, um estado de
 * dois biomas (RS = Pampa + Mata Atlântica) podia mostrar "Pampa" no balão e
 * selecionar "Mata Atlântica" no clique. Aqui a resposta é uma só: vale o
 * polígono desenhado no topo do ponto e, quando não há nenhum, o primeiro
 * bioma do estado clicado.
 *
 * @example resolveBiomeAtPoint(map, event.point, "ba") // "Caatinga"
 */
export function resolveBiomeAtPoint(
  map: MaplibreMap | null,
  point: PointLike,
  uf: string | undefined,
): string | undefined {
  const renderedBiome = map ? findRenderedBiome(map, point) : undefined;
  if (renderedBiome) return renderedBiome;

  if (!uf) return undefined;
  return getStateBiomes(uf).find((biome) => BIOME_VALUES.has(biome));
}
