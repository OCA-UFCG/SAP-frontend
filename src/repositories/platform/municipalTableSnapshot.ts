import "server-only";

import { mkdir, open, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { deflateRawSync, inflateRawSync } from "node:zlib";

/**
 * As linhas municipais de cada tabela estatística do Earth Engine, gravadas em
 * disco com um índice por município.
 *
 * O relatório de um município lia a série de cada índice no Earth Engine: ~10 s
 * no primeiro relatório de cada município, ocupando as 20 vagas de leitura que
 * todo mundo divide. Com o arquivo, a mesma leitura é um punhado de leituras de
 * disco. O arquivo é gerado no deploy (`scripts/build-municipal-tables.ts`) e
 * regravado no servidor quando a tabela muda no Earth Engine; fora da imagem a
 * pasta não existe e tudo é lido do Earth Engine, como antes.
 *
 * Um arquivo por tabela, e não por município, porque é a tabela que muda: uma
 * tabela trocada regrava um arquivo só. O índice deixa ler o pedaço de um
 * município sem abrir o resto — numa tabela anual do CDI são 200 mil linhas.
 *
 * Formato:
 *   "SEDESTB1" | u32 tamanho do cabeçalho | cabeçalho JSON
 *   | u32 municípios | municípios x (u32 código, u32 início, u32 tamanho)
 *   | blocos (deflate de um JSON com as linhas do município, uma lista de
 *     células por linha, na ordem de `columns`)
 */

const MAGIC = Buffer.from("SEDESTB1", "latin1");
const INDEX_ENTRY_BYTES = 12;
const SNAPSHOT_EXTENSION = ".sedestb";

/** O que é preciso saber para ler a tabela de novo quando ela mudar. */
export interface MunicipalTableLayout {
  columns: string[];
  levelProperty: string;
  municipalityCodeProperty: string;
}

interface MunicipalTableHeader extends MunicipalTableLayout {
  schemaVersion: 1;
  assetId: string;
  /** Quando a leitura no Earth Engine começou, em ms desde 1970. */
  readAt: number;
}

export interface MunicipalTableSnapshotInfo extends MunicipalTableLayout {
  assetId: string;
  readAt: number;
}

/**
 * Onde ficam os arquivos. Na imagem do deploy é `data/municipal-tables`, gerada
 * pelo `Dockerfile.production`.
 */
export function getMunicipalTableSnapshotDir(): string {
  return (
    process.env.MUNICIPAL_TABLE_SNAPSHOT_DIR ??
    path.join(process.cwd(), "data", "municipal-tables")
  );
}

function getSnapshotFilePath(assetId: string): string {
  return path.join(
    getMunicipalTableSnapshotDir(),
    `${encodeURIComponent(assetId)}${SNAPSHOT_EXTENSION}`,
  );
}

/**
 * Grava as linhas municipais de uma tabela. `rows` traz uma lista de células
 * por linha, na ordem de `layout.columns`.
 *
 * A gravação vai para um arquivo temporário e só então troca de nome, para um
 * relatório lido no meio dela nunca ver um arquivo pela metade.
 *
 * @example
 * await writeMunicipalTableSnapshot("projects/x/t_2024", layout, rows, startedAt);
 */
export async function writeMunicipalTableSnapshot(
  assetId: string,
  layout: MunicipalTableLayout,
  rows: readonly unknown[][],
  readAt: number,
): Promise<void> {
  const codeIndex = layout.columns.indexOf(layout.municipalityCodeProperty);
  if (codeIndex < 0) {
    throw new Error(
      `A tabela ${assetId} foi lida sem a coluna do código do município (${layout.municipalityCodeProperty}).`,
    );
  }

  const rowsByCode = new Map<number, unknown[][]>();
  for (const row of rows) {
    const code = String(row[codeIndex] ?? "").trim();
    if (!/^\d{7}$/u.test(code)) continue;

    const key = Number(code);
    const municipalityRows = rowsByCode.get(key);
    if (municipalityRows) municipalityRows.push(row);
    else rowsByCode.set(key, [row]);
  }

  const codes = [...rowsByCode.keys()].sort((left, right) => left - right);
  const blocks = codes.map((code) =>
    deflateRawSync(JSON.stringify(rowsByCode.get(code))),
  );
  const header: MunicipalTableHeader = {
    schemaVersion: 1,
    assetId,
    readAt,
    columns: [...layout.columns],
    levelProperty: layout.levelProperty,
    municipalityCodeProperty: layout.municipalityCodeProperty,
  };
  const headerBytes = Buffer.from(JSON.stringify(header), "utf8");
  const prefix = Buffer.alloc(MAGIC.length + 4);
  MAGIC.copy(prefix);
  prefix.writeUInt32LE(headerBytes.length, MAGIC.length);

  const index = Buffer.alloc(4 + codes.length * INDEX_ENTRY_BYTES);
  index.writeUInt32LE(codes.length, 0);
  let offset = 0;
  codes.forEach((code, position) => {
    const entry = 4 + position * INDEX_ENTRY_BYTES;
    index.writeUInt32LE(code, entry);
    index.writeUInt32LE(offset, entry + 4);
    index.writeUInt32LE(blocks[position].length, entry + 8);
    offset += blocks[position].length;
  });

  const filePath = getSnapshotFilePath(assetId);
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    temporaryPath,
    Buffer.concat([prefix, headerBytes, index, ...blocks]),
  );
  await rename(temporaryPath, filePath);
}

async function readExactly(
  file: Awaited<ReturnType<typeof open>>,
  length: number,
  position: number,
): Promise<Buffer> {
  const buffer = Buffer.alloc(length);
  const { bytesRead } = await file.read(buffer, 0, length, position);
  if (bytesRead !== length) {
    throw new Error("arquivo truncado");
  }
  return buffer;
}

async function readHeader(file: Awaited<ReturnType<typeof open>>): Promise<{
  header: MunicipalTableHeader;
  indexStart: number;
}> {
  const prefix = await readExactly(file, MAGIC.length + 4, 0);
  if (!prefix.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("formato desconhecido");
  }

  const headerLength = prefix.readUInt32LE(MAGIC.length);
  const header = JSON.parse(
    (await readExactly(file, headerLength, prefix.length)).toString("utf8"),
  ) as MunicipalTableHeader;
  if (header.schemaVersion !== 1) {
    throw new Error(`versão ${header.schemaVersion} desconhecida`);
  }

  return { header, indexStart: prefix.length + headerLength };
}

/** Busca binária do código no índice; devolve [início, tamanho] do bloco. */
function findBlock(index: Buffer, code: number): [number, number] | null {
  let low = 0;
  let high = index.length / INDEX_ENTRY_BYTES - 1;

  while (low <= high) {
    const middle = (low + high) >>> 1;
    const entry = middle * INDEX_ENTRY_BYTES;
    const current = index.readUInt32LE(entry);

    if (current === code) {
      return [index.readUInt32LE(entry + 4), index.readUInt32LE(entry + 8)];
    }
    if (current < code) low = middle + 1;
    else high = middle - 1;
  }

  return null;
}

/**
 * As linhas de um município numa tabela, só com as colunas pedidas — o mesmo
 * formato que a leitura do Earth Engine devolve.
 *
 * Devolve `null` quando não há arquivo da tabela ou quando ele não tem alguma
 * das colunas pedidas; quem chama lê do Earth Engine. Um município que não
 * aparece na tabela devolve uma lista vazia, como o Earth Engine faria.
 *
 * @example
 * await readMunicipalTableRows("projects/x/t_2024", "2507507", ["ano", "classe_1"]);
 * // [{ ano: 2024, classe_1: 12.5 }]
 */
export async function readMunicipalTableRows(
  assetId: string,
  municipalityCode: string,
  properties: readonly string[],
): Promise<Record<string, unknown>[] | null> {
  let file: Awaited<ReturnType<typeof open>>;
  try {
    file = await open(getSnapshotFilePath(assetId), "r");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn(
        `[municipalTables] não foi possível abrir o arquivo de ${assetId}; lendo do Earth Engine.`,
        error,
      );
    }
    return null;
  }

  try {
    const { header, indexStart } = await readHeader(file);
    const columnIndexes = properties.map((property) =>
      header.columns.indexOf(property),
    );
    if (header.assetId !== assetId || columnIndexes.some((index) => index < 0))
      return null;

    const count = (await readExactly(file, 4, indexStart)).readUInt32LE(0);
    const index = await readExactly(
      file,
      count * INDEX_ENTRY_BYTES,
      indexStart + 4,
    );
    const block = findBlock(index, Number(municipalityCode));
    if (!block) return [];

    const dataStart = indexStart + 4 + index.length;
    const rows = JSON.parse(
      inflateRawSync(
        await readExactly(file, block[1], dataStart + block[0]),
      ).toString("utf8"),
    ) as unknown[][];

    return rows.map((cells) =>
      Object.fromEntries(
        properties.map((property, position) => [
          property,
          cells[columnIndexes[position]],
        ]),
      ),
    );
  } catch (error) {
    console.warn(
      `[municipalTables] arquivo ilegível de ${assetId}; lendo do Earth Engine.`,
      error,
    );
    return null;
  } finally {
    await file.close();
  }
}

/**
 * As tabelas que têm arquivo, com o momento em que cada uma foi lida — o que a
 * conferência de alterações no Earth Engine compara com a data da tabela.
 * Sem a pasta, a lista é vazia.
 */
export async function listMunicipalTableSnapshots(): Promise<
  MunicipalTableSnapshotInfo[]
> {
  let names: string[];
  try {
    names = await readdir(getMunicipalTableSnapshotDir());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const snapshots: MunicipalTableSnapshotInfo[] = [];
  for (const name of names) {
    if (!name.endsWith(SNAPSHOT_EXTENSION)) continue;

    const filePath = path.join(getMunicipalTableSnapshotDir(), name);
    try {
      const file = await open(filePath, "r");
      try {
        const { header } = await readHeader(file);
        snapshots.push({
          assetId: header.assetId,
          readAt: header.readAt,
          columns: header.columns,
          levelProperty: header.levelProperty,
          municipalityCodeProperty: header.municipalityCodeProperty,
        });
      } finally {
        await file.close();
      }
    } catch (error) {
      console.warn(
        `[municipalTables] arquivo ilegível ignorado: ${name}`,
        error,
      );
    }
  }

  return snapshots;
}

/** Apaga o arquivo de uma tabela, para as leituras voltarem ao Earth Engine. */
export async function removeMunicipalTableSnapshot(
  assetId: string,
): Promise<void> {
  await rm(getSnapshotFilePath(assetId), { force: true });
}

/** Se a pasta existe — isto é, se este servidor usa os arquivos. */
export async function hasMunicipalTableSnapshotDir(): Promise<boolean> {
  try {
    await readdir(getMunicipalTableSnapshotDir());
    return true;
  } catch {
    return false;
  }
}
