import "server-only";

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
 * @example
 * await saveSpreadsheetSnapshot("pib", snapshot, previous?.assetId);
 * // { assetId: "3xY...", url: "https://assets.ctfassets.net/.../pib.json" }
 */
export async function saveSpreadsheetSnapshot(
  panelLayerId: string,
  snapshot: MunicipalSpreadsheetSnapshot,
  previousAssetId?: string,
  {
    saveAsset = saveContentfulAsset,
  }: SpreadsheetSnapshotStorageDependencies = {},
): Promise<MunicipalSpreadsheetSnapshotRef> {
  const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
  const saved = await saveAsset({
    assetId: previousAssetId,
    bytes: bytes as Uint8Array<ArrayBuffer>,
    contentType: "application/json",
    fileName: `${panelLayerId}-valores.json`,
    title: `Valores da planilha — ${panelLayerId}`,
    locale: SNAPSHOT_LOCALE,
  });

  return { assetId: saved.assetId, url: saved.url };
}
