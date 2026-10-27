import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { roundToDisplayedDecimals } from "@/utils/formatTerritorialNumber";

/**
 * Onde ficam os arquivos com os valores de cada município, um por índice e
 * período. São gerados no deploy, dentro da imagem, por
 * `scripts/build-municipal-statistics.ts`; fora dela a pasta não existe e a
 * leitura volta ao Earth Engine como antes.
 */
export function getMunicipalStatisticsSnapshotDir(): string {
  return (
    process.env.MUNICIPAL_STATISTICS_SNAPSHOT_DIR ??
    path.join(process.cwd(), "data", "municipal-statistics")
  );
}

interface MunicipalStatisticsSnapshotFile {
  schemaVersion: 1;
  assetId: string;
  sourceRevision: string | null;
  generatedAt: string;
  values: Record<string, number[]>;
}

/**
 * O que identifica a tabela que o arquivo copiou. Se o catálogo trocar o asset
 * ou o mapeamento de colunas depois do deploy, o arquivo deixa de valer e a
 * leitura volta ao Earth Engine.
 */
export interface MunicipalStatisticsSnapshotIdentity {
  assetId: string;
  sourceRevision: string | null;
  classCount: number;
}

function getSnapshotFilePath(panelLayerId: string, yearKey: string): string {
  return path.join(
    getMunicipalStatisticsSnapshotDir(),
    encodeURIComponent(panelLayerId),
    `${encodeURIComponent(yearKey)}.json.gz`,
  );
}

/**
 * Grava a distribuição de cada município num período.
 *
 * Os percentuais saem do Earth Engine com 15 casas, e a lista "Territórios por
 * classificação" arredonda para as 2 que mostra antes de ordenar. Guardar já
 * arredondado não muda nada na tela e deixa o arquivo do CDI com ~40 KB em vez
 * de ~90 KB por período.
 */
export async function writeMunicipalStatisticsSnapshot(
  panelLayerId: string,
  yearKey: string,
  identity: Omit<MunicipalStatisticsSnapshotIdentity, "classCount">,
  values: Record<string, number[]>,
): Promise<void> {
  const file: MunicipalStatisticsSnapshotFile = {
    schemaVersion: 1,
    assetId: identity.assetId,
    sourceRevision: identity.sourceRevision,
    generatedAt: new Date().toISOString(),
    values: Object.fromEntries(
      Object.entries(values)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([code, distribution]) => [
          code,
          distribution.map(roundToDisplayedDecimals),
        ]),
    ),
  };
  const filePath = getSnapshotFilePath(panelLayerId, yearKey);

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, gzipSync(JSON.stringify(file)));
}

/**
 * A distribuição de cada município num período, lida do arquivo gerado no
 * deploy. Devolve `null` quando não há arquivo (período publicado depois do
 * deploy, ambiente sem a pasta) ou quando ele é de outra tabela.
 */
export async function readMunicipalStatisticsSnapshot(
  panelLayerId: string,
  yearKey: string,
  identity: MunicipalStatisticsSnapshotIdentity,
): Promise<Record<string, number[]> | null> {
  let file: MunicipalStatisticsSnapshotFile;

  try {
    file = JSON.parse(
      gunzipSync(
        await readFile(getSnapshotFilePath(panelLayerId, yearKey)),
      ).toString("utf8"),
    ) as MunicipalStatisticsSnapshotFile;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn(
        `[municipalStatisticsSnapshot] arquivo ilegível de ${panelLayerId}/${yearKey}; lendo do Earth Engine.`,
        error,
      );
    }
    return null;
  }

  const firstDistribution = Object.values(file.values ?? {})[0];
  if (
    file.schemaVersion !== 1 ||
    file.assetId !== identity.assetId ||
    file.sourceRevision !== identity.sourceRevision ||
    !firstDistribution ||
    firstDistribution.length !== identity.classCount
  ) {
    return null;
  }

  return file.values;
}
