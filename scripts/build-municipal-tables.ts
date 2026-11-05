/**
 * Grava, no build da imagem, as linhas municipais de cada tabela estatística
 * do Earth Engine que o relatório de um município lê. Com os arquivos na
 * imagem, o relatório e o Detalhamento de um município não vão ao Earth Engine:
 * antes, o primeiro relatório de cada município levava ~10 s lendo as séries
 * de todos os índices de lá.
 *
 * O dado é o do momento do deploy. Depois dele, o servidor confere a cada 10
 * minutos se alguma tabela mudou no Earth Engine e regrava só ela
 * (`refreshMissingMunicipalTables`); uma tabela que falhar aqui também é
 * tentada por ele, e enquanto isso é lida do Earth Engine, como antes.
 *
 * Roda pelo `Dockerfile.production`, com a chave do Earth Engine passada como
 * secret do build. Sem a chave não gera nada, e o deploy segue.
 *
 *   npm run generate:municipal-tables
 */
import { stat } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import {
  getMunicipalTableSnapshotDir,
  listMunicipalTableSnapshots,
} from "@/repositories/platform/municipalTableSnapshot";
import {
  buildMunicipalTable,
  planMunicipalTables,
} from "@/services/municipalTableSnapshots";

// Cada leitura traz uma tabela inteira — dezenas de MB num ano do CDI —, então
// poucas de cada vez bastam e seguram a memória do build.
const CONCURRENCY = 6;

async function main() {
  loadEnvConfig(process.cwd());

  if (!process.env.GEE_PRIVATE_KEY) {
    console.warn(
      "[municipalTables] sem GEE_PRIVATE_KEY; nenhum arquivo gerado, o relatório do município vai ler do Earth Engine.",
    );
    return;
  }

  const startedAt = Date.now();
  const tables = [...(await planMunicipalTables())];
  const failures: string[] = [];
  let rows = 0;
  let next = 0;

  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < tables.length) {
        const [assetId, layout] = tables[next++];
        try {
          const count = await buildMunicipalTable(assetId, layout);
          rows += count;
        } catch (error) {
          failures.push(assetId);
          console.warn(
            `[municipalTables] ${assetId} sem arquivo:`,
            error instanceof Error ? error.message : error,
          );
        }
      }
    }),
  );

  const dir = getMunicipalTableSnapshotDir();
  let bytes = 0;
  for (const { assetId } of await listMunicipalTableSnapshots()) {
    bytes += (
      await stat(path.join(dir, `${encodeURIComponent(assetId)}.sedestb`))
    ).size;
  }

  console.log(
    `[municipalTables] ${tables.length - failures.length} de ${tables.length} tabelas (${rows} linhas, ${(bytes / 1024 / 1024).toFixed(1)} MB) gravadas em ${dir} em ${Math.round((Date.now() - startedAt) / 1000)} s.`,
  );
  if (failures.length > 0) {
    console.warn(
      `[municipalTables] vão ler do Earth Engine: ${failures.join("; ")}`,
    );
  }
}

main().then(
  // Os caches do servidor deixam timers abertos; o processo termina aqui.
  () => process.exit(0),
  (error: unknown) => {
    console.error("[municipalTables] falha ao gerar os arquivos:", error);
    // O relatório funciona sem os arquivos, só mais devagar: o deploy não para.
    process.exit(0);
  },
);
