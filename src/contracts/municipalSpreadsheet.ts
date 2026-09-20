import { isGeeStatisticsRecord } from "@/contracts/geeStatisticsAsset";

/**
 * Como o valor de um território maior sai dos municípios que ele contém.
 *
 * `sum` para quantidades que se somam (PIB, população, número de registros) e
 * `mean` para índices que não se somam (IDHM, taxas). Não há média ponderada
 * porque a planilha não traz coluna de peso: a convenção fixa as colunas
 * territoriais e o valor, e nada mais.
 */
export type MunicipalSpreadsheetAggregation = "sum" | "mean";

/**
 * As colunas territoriais que toda planilha do catálogo repete, na convenção
 * acordada com quem produz as bases.
 *
 * Elas são fixas de propósito: é o que permite ao operador colar um link e
 * publicar um índice sem mapear coluna nenhuma. As colunas de dado, essas sim,
 * variam por índice e são reconhecidas pelo sufixo `_{ano}`.
 */
export const MUNICIPAL_SPREADSHEET_COLUMNS = Object.freeze({
  municipalityCode: "CD_MUN",
  municipalityName: "NM_MUN",
  stateCode: "SIGLA_UF",
  stateName: "NM_UF",
  region: "NM_REGIAO",
  biome: "BIOMA_PRED",
  semiarid: "SEMIÁRIDO",
  asd: "ASD_ENTORN",
});

/** As colunas sem as quais a planilha não vira índice. */
export const REQUIRED_MUNICIPAL_SPREADSHEET_COLUMNS = Object.freeze([
  MUNICIPAL_SPREADSHEET_COLUMNS.municipalityCode,
  MUNICIPAL_SPREADSHEET_COLUMNS.municipalityName,
  MUNICIPAL_SPREADSHEET_COLUMNS.stateCode,
]);

/**
 * Onde o instantâneo dos valores foi guardado depois de lido da planilha.
 *
 * Cada publicação grava um arquivo novo e move o ponteiro para ele: o arquivo
 * anterior continua intacto, porque é o que a produção lê até a entry terminar
 * de publicar. O `assetId` identifica o arquivo desta versão, para achá-lo no
 * Contentful — não é um lugar a ser regravado.
 */
export interface MunicipalSpreadsheetSnapshotRef {
  assetId: string;
  url: string;
}

/**
 * Estatística lida de uma planilha do Google, e não do Earth Engine.
 *
 * O link é lido na validação do catálogo, que calcula os valores de todos os
 * recortes territoriais e os guarda em memória para a prévia; a publicação
 * relê, confere e grava o instantâneo. Em produção a plataforma lê o
 * instantâneo, nunca o Google Drive — a planilha pode ser movida, renomeada ou
 * fechada sem derrubar o índice publicado.
 *
 * @example
 * const source: MunicipalSpreadsheetStatisticsSource = {
 *   kind: "municipal-spreadsheet",
 *   spreadsheetUrl: "https://docs.google.com/spreadsheets/d/1OgW.../edit",
 *   fileId: "1OgW6thfyXJX1TlW225BwNg4qvpXHzYAu",
 *   valuePrefix: "pib",
 *   aggregation: "sum",
 * };
 */
export interface MunicipalSpreadsheetStatisticsSource {
  kind: "municipal-spreadsheet";
  /** Link colado pelo operador; guardado para a revalidação reler a planilha. */
  spreadsheetUrl: string;
  /** Id do arquivo no Drive, extraído do link. */
  fileId: string;
  /** Prefixo das colunas de dado: `pib` para `pib_2010`, `pib_2023`. */
  valuePrefix: string;
  aggregation: MunicipalSpreadsheetAggregation;
  snapshot?: MunicipalSpreadsheetSnapshotRef;
}

export function isMunicipalSpreadsheetSource(
  value: unknown,
): value is MunicipalSpreadsheetStatisticsSource {
  return isGeeStatisticsRecord(value) && value.kind === "municipal-spreadsheet";
}

function requiredText(value: unknown, label: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    throw new Error(
      `${label} é obrigatório na fonte de planilha; recebido ${JSON.stringify(value) ?? "vazio"}.`,
    );
  }
  return text;
}

function parseSnapshot(value: unknown): MunicipalSpreadsheetSnapshotRef | null {
  if (!isGeeStatisticsRecord(value)) return null;
  return {
    assetId: requiredText(value.assetId, "Id do asset do instantâneo"),
    url: requiredText(value.url, "URL do instantâneo"),
  };
}

export function parseMunicipalSpreadsheetSource(
  value: unknown,
): MunicipalSpreadsheetStatisticsSource {
  if (!isMunicipalSpreadsheetSource(value)) {
    throw new Error("A fonte estatística deve ser uma planilha municipal.");
  }
  if (value.aggregation !== "sum" && value.aggregation !== "mean") {
    throw new Error(
      `A agregação territorial deve ser soma ou média dos municípios; recebido ${JSON.stringify(value.aggregation)}.`,
    );
  }

  const snapshot = parseSnapshot(value.snapshot);
  return {
    kind: "municipal-spreadsheet",
    spreadsheetUrl: requiredText(value.spreadsheetUrl, "Link da planilha"),
    fileId: requiredText(value.fileId, "Id do arquivo no Drive"),
    valuePrefix: requiredText(value.valuePrefix, "Prefixo das colunas de dado"),
    aggregation: value.aggregation,
    ...(snapshot ? { snapshot } : {}),
  };
}
