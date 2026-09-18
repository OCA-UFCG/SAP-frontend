import "server-only";

import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { gunzip as gunzipCallback, gzip as gzipCallback } from "node:zlib";
import { MUNICIPAL_REPORT_SCHEMA_VERSION } from "@/contracts/municipalReport";
import type { MunicipalReportData } from "@/contracts/municipalReport";

const gzip = promisify(gzipCallback);
const gunzip = promisify(gunzipCallback);

/**
 * Versão do envelope gravado em disco, não do relatório.
 *
 * Quem muda o formato do arquivo (campos do envelope, codificação, nome) sobe
 * este número; os arquivos antigos passam a ser lidos como ausentes em vez de
 * interpretados errado. O `schemaVersion` do próprio relatório é conferido
 * separadamente, porque as duas coisas mudam por motivos diferentes.
 */
const STORE_FORMAT_VERSION = 1;
const DEFAULT_TTL_MS = 86_400_000;
// Um relatório de ~320 KiB vira ~11 KiB comprimido (ele repete rótulo, cor e
// classe a cada período), então mil arquivos ocupam ~15 MiB. É o teto para o
// diretório não crescer sem fim; o disco não é o recurso escasso aqui.
const DEFAULT_MAX_FILES = 1000;
const ENTRY_EXTENSION = ".json.gz";
const DEFAULT_DIRECTORY = "data/runtime/municipal-report-cache";

interface StoredReportEnvelope {
  formatVersion: number;
  key: string;
  storedAt: number;
  expiresAt: number;
  report: MunicipalReportData;
}

export interface StoredReportReading {
  report: MunicipalReportData;
  expired: boolean;
}

const failuresAlreadyLogged = new Set<string>();

/**
 * Um erro de disco nunca derruba o relatório: o pior caso é montá-lo de novo.
 * O log sai uma vez por tipo de falha para que um diretório sem permissão não
 * escreva uma linha por requisição.
 */
function reportStoreFailure(action: string, cause: unknown) {
  if (failuresAlreadyLogged.has(action)) return;
  failuresAlreadyLogged.add(action);
  console.warn(
    `[municipalReport] cache em disco indisponível (${action}):`,
    cause,
  );
}

function getStoreDirectory() {
  const configured = process.env.MUNICIPAL_REPORT_DISK_CACHE_DIR?.trim();
  if (configured === "off") return null;
  return path.resolve(process.cwd(), configured || DEFAULT_DIRECTORY);
}

function getTtlMs() {
  const seconds = Number(process.env.MUNICIPAL_REPORT_DISK_CACHE_TTL_SECONDS);
  if (!Number.isFinite(seconds) || seconds <= 0) return DEFAULT_TTL_MS;
  return Math.floor(seconds * 1000);
}

function getMaxFiles() {
  const value = Number(process.env.MUNICIPAL_REPORT_DISK_CACHE_MAX_FILES);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_MAX_FILES;
  return Math.floor(value);
}

/**
 * O conteúdo é comprimido porque o relatório repete a mesma classe, o mesmo
 * rótulo e a mesma cor a cada período: 320 KiB viram 11 KiB. Medido, ler o
 * arquivo pequeno e descomprimir sai na frente de ler o arquivo inteiro
 * (2,6 ms contra 3,0 ms), e comprimir custa ~1 ms numa escrita que só acontece
 * depois de uma montagem de segundos.
 */

/**
 * O nome do arquivo é o hash da chave porque a chave não cabe num nome de
 * arquivo: ela carrega a lista de camadas com a versão de cada uma, o que passa
 * de 900 caracteres num relatório completo, e o limite do sistema de arquivos é
 * 255 bytes. O hash é de tamanho fixo e só tem caracteres seguros.
 *
 * Como o hash não é reversível, a chave inteira é gravada dentro do arquivo e
 * conferida na leitura — é isso que impede que uma colisão, ou um arquivo
 * deixado por outra versão do código, devolva o relatório de outro município.
 */
function resolveEntryPath(directory: string, key: string) {
  const digest = createHash("sha256").update(key).digest("hex").slice(0, 32);
  return path.join(directory, `${digest}${ENTRY_EXTENSION}`);
}

function parseEnvelope(
  content: string,
  key: string,
): StoredReportEnvelope | null {
  const envelope = JSON.parse(content) as Partial<StoredReportEnvelope>;
  if (envelope.formatVersion !== STORE_FORMAT_VERSION) return null;
  if (envelope.key !== key) return null;
  if (envelope.report?.schemaVersion !== MUNICIPAL_REPORT_SCHEMA_VERSION)
    return null;
  if (!Number.isFinite(envelope.expiresAt)) return null;
  return envelope as StoredReportEnvelope;
}

/**
 * Devolve o relatório gravado para esta chave, dizendo se ele já passou do
 * prazo. O vencido não é apagado aqui de propósito: ele ainda serve de rede de
 * segurança se a remontagem falhar, o mesmo comportamento dos outros caches
 * desta base.
 *
 * @example
 * const stored = await readStoredReport(key);
 * if (stored && !stored.expired) return stored.report;
 */
export async function readStoredReport(
  key: string,
): Promise<StoredReportReading | null> {
  const directory = getStoreDirectory();
  if (!directory) return null;

  try {
    const compressed = await readFile(resolveEntryPath(directory, key));
    const envelope = parseEnvelope(
      (await gunzip(compressed)).toString("utf8"),
      key,
    );
    if (!envelope) return null;
    return {
      report: envelope.report,
      expired: envelope.expiresAt <= Date.now(),
    };
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException)?.code !== "ENOENT") {
      reportStoreFailure("leitura", cause);
    }
    return null;
  }
}

/**
 * Grava primeiro num arquivo temporário e só então renomeia para o nome final.
 * `rename` é atômico dentro do mesmo sistema de arquivos, então quem lê sempre
 * encontra um relatório inteiro: uma queda no meio da escrita deixa o arquivo
 * anterior ou nenhum, nunca um JSON pela metade.
 */
export async function storeReport(
  key: string,
  report: MunicipalReportData,
): Promise<void> {
  const directory = getStoreDirectory();
  if (!directory) return;

  const storedAt = Date.now();
  const envelope: StoredReportEnvelope = {
    formatVersion: STORE_FORMAT_VERSION,
    key,
    storedAt,
    expiresAt: storedAt + getTtlMs(),
    report,
  };
  const entryPath = resolveEntryPath(directory, key);
  const temporaryPath = `${entryPath}.${process.pid}.${storedAt}.tmp`;

  try {
    await mkdir(directory, { recursive: true });
    await writeFile(temporaryPath, await gzip(JSON.stringify(envelope)));
    await rename(temporaryPath, entryPath);
    await trimStore(directory);
  } catch (cause) {
    reportStoreFailure("escrita", cause);
    await unlink(temporaryPath).catch(() => {});
  }
}

async function listEntryFiles(directory: string) {
  const files = await readdir(directory);
  return files.filter((file) => file.endsWith(ENTRY_EXTENSION));
}

/**
 * Descarta os arquivos mais antigos quando o diretório passa do teto. A ordem é
 * por data de modificação, que o próprio sistema de arquivos mantém — não há
 * índice para carregar nem arquivo de controle para manter em dia.
 */
async function trimStore(directory: string) {
  const maxFiles = getMaxFiles();
  const files = await listEntryFiles(directory);
  if (files.length <= maxFiles) return;

  const aged = await Promise.all(
    files.map(async (file) => {
      const fullPath = path.join(directory, file);
      const modifiedAt = await stat(fullPath).then(
        (info) => info.mtimeMs,
        () => 0,
      );
      return { fullPath, modifiedAt };
    }),
  );
  aged.sort((first, second) => first.modifiedAt - second.modifiedAt);

  for (const { fullPath } of aged.slice(0, aged.length - maxFiles)) {
    await unlink(fullPath).catch(() => {});
  }
}

/**
 * Apaga tudo o que está gravado. Chamado quando o catálogo publica um índice:
 * sem isso o operador veria o relatório anterior pelo prazo inteiro do arquivo,
 * que é bem maior que o do cache em memória.
 */
export async function clearStoredReports(): Promise<void> {
  const directory = getStoreDirectory();
  if (!directory) return;

  try {
    await rm(directory, { recursive: true, force: true });
  } catch (cause) {
    reportStoreFailure("limpeza", cause);
  }
}
