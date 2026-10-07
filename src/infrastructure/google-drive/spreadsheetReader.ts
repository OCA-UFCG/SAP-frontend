import "server-only";

import * as XLSX from "xlsx";
import { buildSpreadsheetDownloadUrls } from "@/utils/municipalSpreadsheetLink";

/**
 * Teto de tamanho do arquivo baixado. Uma base municipal do Brasil inteiro
 * ocupa menos de 1 MB; este limite existe para que um link apontando para
 * outra coisa não vire um download de centenas de megabytes no servidor.
 */
const MAX_SPREADSHEET_BYTES = 25 * 1024 * 1024;

export interface SpreadsheetTable {
  header: string[];
  rows: unknown[][];
  sheetName: string;
}

export interface SpreadsheetReaderDependencies {
  fetchSpreadsheet?: typeof fetch;
}

async function downloadSpreadsheet(
  fileId: string,
  fetchSpreadsheet: typeof fetch,
): Promise<Uint8Array> {
  const failures: string[] = [];

  for (const url of buildSpreadsheetDownloadUrls(fileId)) {
    const response = await fetchSpreadsheet(url, { cache: "no-store" });
    if (!response.ok) {
      failures.push(`${url} respondeu ${response.status}`);
      continue;
    }
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_SPREADSHEET_BYTES) {
      throw new Error(
        `A planilha ${fileId} tem ${Math.round(buffer.byteLength / 1024 / 1024)} MB, acima do limite de ${MAX_SPREADSHEET_BYTES / 1024 / 1024} MB.`,
      );
    }
    // O Google responde 200 com uma página HTML quando o arquivo não é
    // público: a tela de login ou o aviso de "solicitar acesso". Sem esta
    // checagem o erro que chegaria ao operador seria "arquivo corrompido", que
    // aponta para o lugar errado. Toda planilha real começa com a assinatura
    // de ZIP, porque xlsx é um ZIP.
    const bytes = new Uint8Array(buffer);
    if (bytes[0] === 0x50 && bytes[1] === 0x4b) return bytes;
    failures.push(`${url} devolveu um conteúdo que não é planilha`);
  }

  throw new Error(
    `Não consegui baixar a planilha ${fileId}: ${failures.join("; ")}. Confira se o link está compartilhado como "qualquer pessoa com o link pode ver".`,
  );
}

function toTable(bytes: Uint8Array, fileId: string): SpreadsheetTable {
  const workbook = XLSX.read(bytes, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error(`A planilha ${fileId} não tem nenhuma aba.`);
  }

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(
    workbook.Sheets[sheetName],
    {
      header: 1,
      blankrows: false,
      defval: null,
    },
  );
  const [header, ...rows] = matrix;
  if (!header?.length) {
    throw new Error(`A aba ${sheetName} da planilha ${fileId} está vazia.`);
  }

  return {
    header: header.map((name) => String(name ?? "").trim()),
    rows,
    sheetName,
  };
}

/**
 * Baixa uma planilha do Google e devolve a primeira aba como cabeçalho e linhas.
 *
 * Só a primeira aba é lida: a convenção das bases do catálogo é uma aba única
 * (`Base_unida`), e escolher entre abas seria mais um campo no formulário para
 * um caso que não existe.
 *
 * @example
 * const table = await readGoogleSpreadsheet("1OgW6thfyXJX1TlW225BwNg4qvpXHzYAu");
 * table.header.slice(0, 2); // ["CD_MUN", "NM_MUN"]
 */
export async function readGoogleSpreadsheet(
  fileId: string,
  { fetchSpreadsheet = fetch }: SpreadsheetReaderDependencies = {},
): Promise<SpreadsheetTable> {
  const bytes = await downloadSpreadsheet(fileId, fetchSpreadsheet);
  return toTable(bytes, fileId);
}
