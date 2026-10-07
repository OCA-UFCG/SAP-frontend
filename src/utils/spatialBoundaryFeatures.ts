import type { FeatureCollection, Geometry } from "geojson";
import { getActiveBoundaryNames } from "@/utils/spatialScope";

type BoundaryCollection = FeatureCollection<Geometry, { name: string }>;

/**
 * Recorta a coleção de contornos para as features da seleção ativa.
 *
 * A rota devolve todos os biomas de uma vez, porque o mapa precisa dos vizinhos
 * para o clique e o hover trocarem de bioma. Quem enquadra a câmera, porém,
 * precisa só do recorte selecionado: com a coleção inteira, a caixa envolvente
 * é o Brasil e vira a mesma para os seis biomas, então a câmera para de se
 * mover ao trocar de bioma.
 *
 * Devolve `null` quando nenhuma feature corresponde, para o chamador cair no
 * enquadramento pela união dos estados da área em vez de não enquadrar nada.
 *
 * @example selectActiveBoundaryFeatures(allBiomes, "Caatinga") // só a Caatinga
 */
export function selectActiveBoundaryFeatures(
  boundaryGeoJson: BoundaryCollection | null,
  spatialValue: string,
): BoundaryCollection | null {
  if (!boundaryGeoJson) return null;

  const activeNames = new Set(getActiveBoundaryNames(spatialValue));
  const features = boundaryGeoJson.features.filter((feature) =>
    activeNames.has(feature.properties?.name),
  );

  if (!features.length) return null;

  return { type: "FeatureCollection", features };
}
