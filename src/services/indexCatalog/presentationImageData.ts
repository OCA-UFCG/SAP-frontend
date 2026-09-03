import "server-only";

import {
  getLocalizedEntryField,
  type ContentfulManagementEntry,
} from "@/services/indexCatalog/contentfulManagement";
import type { CompactTerritorialAnalysisDataset } from "@/utils/analysis";
import { isCompactImageData } from "@/utils/imageData";
import type { ImageDataConfig } from "@/utils/interfaces";

/**
 * O `imageData` gravado na entry, exigindo o formato `territorial-compact`.
 *
 * Mora num módulo próprio porque é a leitura comum das duas escritas do escopo
 * de apresentação: dele saem os períodos e o mapa da prévia
 * (`presentationService`) e as linhas da legenda (`legacyAppearanceService`).
 *
 * @example
 * readCompactImageData(entry, "en-US", "terraibge").classes.length; // 12
 */
export function readCompactImageData(
  entry: ContentfulManagementEntry,
  locale: string,
  panelLayerId: string,
): CompactTerritorialAnalysisDataset {
  const imageData = getLocalizedEntryField<ImageDataConfig>(
    entry,
    "imageData",
    locale,
  );

  if (!isCompactImageData(imageData)) {
    throw new Error(
      `O imageData de ${panelLayerId} não está no formato territorial-compact, então o catálogo não consegue desenhar o mapa, descobrir os períodos nem editar a legenda dele.`,
    );
  }

  return imageData;
}
