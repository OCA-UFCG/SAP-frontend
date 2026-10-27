/**
 * Grava, no build da imagem, a distribuição de cada município por índice e
 * período — o que a lista "Territórios por classificação" mostra num estado,
 * bioma, Semiárido ou ASD. Com os arquivos na imagem, a lista não vai ao Earth
 * Engine: antes era uma leitura de ~2 s por índice e período, refeita a cada
 * deploy e guardada na memória do servidor.
 *
 * O dado é o do momento do deploy. Uma tabela alterada no Earth Engine depois
 * disso só aparece na lista no deploy seguinte; um período publicado depois
 * dele não tem arquivo e é lido do Earth Engine, como antes.
 *
 * Roda pelo `Dockerfile.production`, com a chave do Earth Engine passada como
 * secret do build. Sem a chave não gera nada, e um período que falhar fica sem
 * arquivo: nos dois casos o site lê do Earth Engine e o deploy segue.
 *
 *   npm run generate:municipal-statistics
 */
import { loadEnvConfig } from "@next/env";
import { getGeeStatisticsSource } from "@/config/geeStatistics";
import { isGeeMunicipalValueTableSource } from "@/contracts/geeMunicipalValueTable";
import { resolveGeeStatisticsSource } from "@/contracts/geeStatistics";
import { isMunicipalSpreadsheetSource } from "@/contracts/municipalSpreadsheet";
import { readGeeStatisticsMunicipalitiesAssetValues } from "@/repositories/platform/geeStatisticsRepository";
import {
  getMunicipalStatisticsSnapshotDir,
  writeMunicipalStatisticsSnapshot,
} from "@/repositories/platform/municipalStatisticsSnapshot";
import { getPanelLayers } from "@/repositories/platform/panelLayerRepository";
import { isCompactImageData } from "@/utils/imageData";

// Cada leitura traz uma tabela inteira — até 12 MB num ano do CDI —, então
// poucas de cada vez bastam e seguram a memória do build.
const CONCURRENCY = 8;

interface SnapshotTask {
  label: string;
  periodCount: number;
  run: () => Promise<number>;
}

/**
 * Os períodos publicados agrupados pelo asset que os guarda: uma leitura por
 * asset. Um período que não resolve um asset fica de fora, como no painel.
 */
function groupPeriodsByAsset(
  source: Parameters<typeof resolveGeeStatisticsSource>[0],
  periodKeys: readonly string[],
): Map<string, string[]> {
  const periodsByAsset = new Map<string, string[]>();

  for (const periodKey of periodKeys) {
    try {
      const { assetId } = resolveGeeStatisticsSource(source, periodKey);
      periodsByAsset.set(assetId, [
        ...(periodsByAsset.get(assetId) ?? []),
        periodKey,
      ]);
    } catch {
      continue;
    }
  }

  return periodsByAsset;
}

async function buildTasks(): Promise<SnapshotTask[]> {
  const tasks: SnapshotTask[] = [];

  for (const layer of await getPanelLayers()) {
    if (!isCompactImageData(layer.imageData)) continue;

    const source = layer.statisticsSource ?? getGeeStatisticsSource(layer.id);
    if (
      !source ||
      isMunicipalSpreadsheetSource(source) ||
      isGeeMunicipalValueTableSource(source)
    ) {
      continue;
    }

    const periodKeys = Object.keys(layer.imageData.years).sort();
    const classCount = layer.imageData.classes.length;
    const sourceRevision =
      "sourceRevision" in source && typeof source.sourceRevision === "string"
        ? source.sourceRevision
        : null;

    for (const [assetId, assetPeriodKeys] of groupPeriodsByAsset(
      source,
      periodKeys,
    )) {
      tasks.push({
        label: `${layer.id} (${assetId.split("/").at(-1)})`,
        periodCount: assetPeriodKeys.length,
        run: async () => {
          const valuesByPeriod =
            await readGeeStatisticsMunicipalitiesAssetValues(
              source,
              classCount,
              assetPeriodKeys,
              periodKeys,
            );
          let written = 0;

          for (const [yearKey, values] of valuesByPeriod) {
            if (Object.keys(values).length === 0) continue;
            await writeMunicipalStatisticsSnapshot(
              layer.id,
              yearKey,
              { assetId, sourceRevision },
              values,
            );
            written += 1;
          }
          return written;
        },
      });
    }
  }

  return tasks;
}

async function main() {
  loadEnvConfig(process.cwd());

  if (!process.env.GEE_PRIVATE_KEY) {
    console.warn(
      "[municipalStatistics] sem GEE_PRIVATE_KEY; nenhum arquivo gerado, a lista de municípios vai ler do Earth Engine.",
    );
    return;
  }

  const startedAt = Date.now();
  const tasks = await buildTasks();
  const periodCount = tasks.reduce(
    (total, task) => total + task.periodCount,
    0,
  );
  const failures: string[] = [];
  let written = 0;
  let next = 0;

  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < tasks.length) {
        const task = tasks[next++];
        try {
          const count = await task.run();
          written += count;
        } catch (error) {
          failures.push(`${task.label}: ${task.periodCount} período(s)`);
          console.warn(
            `[municipalStatistics] ${task.label} sem arquivos:`,
            error instanceof Error ? error.message : error,
          );
        }
      }
    }),
  );

  console.log(
    `[municipalStatistics] ${written} de ${periodCount} períodos gravados em ${getMunicipalStatisticsSnapshotDir()} em ${Math.round((Date.now() - startedAt) / 1000)} s.`,
  );
  if (failures.length > 0) {
    console.warn(
      `[municipalStatistics] vão ler do Earth Engine: ${failures.join("; ")}`,
    );
  }
}

main().then(
  // Os caches do servidor deixam timers abertos; o processo termina aqui.
  () => process.exit(0),
  (error: unknown) => {
    console.error("[municipalStatistics] falha ao gerar os arquivos:", error);
    // A lista funciona sem os arquivos, só mais devagar: o deploy não para.
    process.exit(0);
  },
);
