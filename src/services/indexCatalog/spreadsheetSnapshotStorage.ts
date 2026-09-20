import "server-only";

import type { PublishedMunicipalSpreadsheetSource } from "@/contracts/geeStatistics";
import type { MunicipalSpreadsheetSnapshotRef } from "@/contracts/municipalSpreadsheet";
import type { MunicipalSpreadsheetSnapshot } from "@/contracts/municipalSpreadsheetSnapshot";
import { saveContentfulAsset } from "@/services/indexCatalog/contentfulAssets";

/** O Contentful guarda o arquivo por locale; o catálogo publica em `en-US`. */
const SNAPSHOT_LOCALE = "en-US";

export interface SpreadsheetSnapshotStorageDependencies {
  saveAsset?: typeof saveContentfulAsset;
}

/**
 * Guarda o instantâneo de valores de um índice de planilha como asset do
 * Contentful.
 *
 * Os valores não cabem em `panelLayer.imageData`: são mais de cinco mil
 * municípios por período, e o `imageData` de toda camada é lido e revalidado a
 * cada requisição do Monitoramento — enfiar centenas de KB ali custaria CPU em
 * todo pedido da plataforma, inclusive nos índices que não têm nada a ver com
 * planilha. Num asset, o arquivo é lido sob demanda e fica em cache.
 *
 * O arquivo é sempre novo, nunca uma regravação: enquanto a entry não terminar
 * de publicar, a produção continua lendo a URL antiga, e trocar o conteúdo dela
 * derrubaria o índice publicado se a publicação falhasse no meio.
 *
 * @example
 * await saveSpreadsheetSnapshot("pib", snapshot);
 * // { assetId: "3xY...", url: "https://assets.ctfassets.net/.../pib.json" }
 */
export async function saveSpreadsheetSnapshot(
  panelLayerId: string,
  snapshot: MunicipalSpreadsheetSnapshot,
  {
    saveAsset = saveContentfulAsset,
  }: SpreadsheetSnapshotStorageDependencies = {},
): Promise<MunicipalSpreadsheetSnapshotRef> {
  const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
  const saved = await saveAsset({
    bytes: bytes as Uint8Array<ArrayBuffer>,
    contentType: "application/json",
    fileName: `${panelLayerId}-valores.json`,
    title: `Valores da planilha — ${panelLayerId}`,
    locale: SNAPSHOT_LOCALE,
  });

  return { assetId: saved.assetId, url: saved.url };
}

/**
 * Grava o instantâneo do índice que está sendo publicado e devolve a fonte
 * apontando para o arquivo novo.
 *
 * É o único momento em que um índice de planilha escreve no Contentful, e vem
 * depois da conferência da impressão digital de propósito: uma publicação
 * recusada com "Revalide antes de publicar" não pode ter mexido no dado que a
 * produção está servindo.
 *
 * @example
 * const source = await publishSpreadsheetSnapshot("pib", snapshot, build.statisticsSource);
 */
export async function publishSpreadsheetSnapshot(
  panelLayerId: string,
  snapshot: MunicipalSpreadsheetSnapshot,
  source: PublishedMunicipalSpreadsheetSource,
  dependencies: SpreadsheetSnapshotStorageDependencies = {},
): Promise<PublishedMunicipalSpreadsheetSource> {
  const saved = await saveSpreadsheetSnapshot(
    panelLayerId,
    snapshot,
    dependencies,
  );
  return { ...source, snapshot: saved };
}
