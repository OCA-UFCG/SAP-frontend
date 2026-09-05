import "server-only";

import ee from "@google/earthengine";
import type { GeeMunicipalValueTableStatisticsSource } from "@/contracts/geeMunicipalValueTable";
import { evaluateGeeObject } from "@/infrastructure/earth-engine/client";

/**
 * Tudo que a validação de uma tabela municipal precisa saber do Earth Engine,
 * numa leitura só.
 *
 * A contagem por coluna existe por um detalhe caro do `reduceColumns`: ele
 * descarta a feature inteira quando qualquer seletor é nulo. Um único município
 * sem valor em 2013 não estragaria só 2013 — sumiria daquele município em todos
 * os períodos da mesma leitura, e o estado inteiro sairia com o total errado sem
 * nenhum erro.
 */
export interface MunicipalValueTableProbe {
  rowCount: number;
  namedCount: number;
  codedCount: number;
  distinctCodeCount: number;
  stateValues: unknown[];
  completeValueCounts: number[];
}

export interface MunicipalValueTableProbeRequest {
  assetId: string;
  valueColumns: string[];
}

function buildProbeExpression(
  source: GeeMunicipalValueTableStatisticsSource,
  { assetId, valueColumns }: MunicipalValueTableProbeRequest,
) {
  const collection = ee.FeatureCollection(assetId);
  const { municipalityCode, locationName, stateCode } = source.properties;

  return ee.Dictionary({
    rowCount: collection.size(),
    namedCount: collection.filter(ee.Filter.notNull([locationName])).size(),
    codedCount: collection.filter(ee.Filter.notNull([municipalityCode])).size(),
    distinctCodeCount: collection.distinct([municipalityCode]).size(),
    stateValues: collection.aggregate_array(stateCode).distinct(),
    completeValueCounts: ee.List(
      valueColumns.map((column) =>
        collection.filter(ee.Filter.notNull([column])).size(),
      ),
    ),
  });
}

/**
 * As sondagens de várias tabelas numa ida só ao Earth Engine.
 *
 * @example
 * await readMunicipalValueTableProbes(source, [
 *   { assetId: "projects/x/assets/pob_total", valueColumns: ["2024", "2025"] },
 * ]);
 */
export async function readMunicipalValueTableProbes(
  source: GeeMunicipalValueTableStatisticsSource,
  requests: MunicipalValueTableProbeRequest[],
): Promise<Map<string, MunicipalValueTableProbe>> {
  if (requests.length === 0) return new Map();

  const evaluated = await evaluateGeeObject<
    Record<string, MunicipalValueTableProbe>
  >(
    ee.Dictionary(
      Object.fromEntries(
        requests.map((request) => [
          request.assetId,
          buildProbeExpression(source, request),
        ]),
      ),
    ),
  );

  if (!evaluated || typeof evaluated !== "object") {
    throw new Error(
      `Resposta inválida ao validar as tabelas ${requests.map((request) => request.assetId).join(", ")}.`,
    );
  }

  return new Map(Object.entries(evaluated));
}
