import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveWorkspacePath } from "../shared/paths.mjs";

export const DRIVE_CSV_SNAPSHOT_FILE = ".drive-csv-snapshot.json";

function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} deve ser uma string não vazia.`);
  }
}

function normalizeSnapshotFile(file, index) {
  if (!file || typeof file !== "object" || Array.isArray(file)) {
    throw new Error(`files[${index}] deve ser um objeto.`);
  }

  for (const field of ["id", "name", "localName", "modifiedTime"]) {
    assertNonEmptyString(file[field], `files[${index}].${field}`);
  }

  const modifiedAt = Date.parse(file.modifiedTime);
  if (!Number.isFinite(modifiedAt)) {
    throw new Error(
      `files[${index}].modifiedTime inválido: ${JSON.stringify(file.modifiedTime)}.`,
    );
  }

  return {
    id: file.id,
    name: file.name,
    localName: file.localName,
    modifiedTime: file.modifiedTime,
    modifiedAt,
    ...(file.mimeType ? { mimeType: file.mimeType } : {}),
    ...(file.size !== undefined ? { size: file.size } : {}),
  };
}

function normalizeSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    throw new Error("O manifesto do snapshot do Drive deve conter um objeto.");
  }
  if (snapshot.schemaVersion !== 1) {
    throw new Error(
      `schemaVersion do snapshot do Drive deve ser 1; recebido ${JSON.stringify(snapshot.schemaVersion)}.`,
    );
  }
  if (!Array.isArray(snapshot.files) || snapshot.files.length === 0) {
    throw new Error(
      "O snapshot do Drive deve conter uma lista não vazia de arquivos.",
    );
  }

  const files = snapshot.files.map(normalizeSnapshotFile);
  const localNames = new Set();
  for (const file of files) {
    const normalizedName = file.localName.toLocaleLowerCase("pt-BR");
    if (localNames.has(normalizedName)) {
      throw new Error(
        `O snapshot do Drive contém nomes locais duplicados: ${file.localName}.`,
      );
    }
    localNames.add(normalizedName);
  }

  return {
    schemaVersion: 1,
    folderId: snapshot.folderId ?? null,
    capturedAt: snapshot.capturedAt ?? null,
    files,
  };
}

export async function writeDriveCsvSnapshot(csvDir, folderId, downloads) {
  const snapshotPath = path.join(
    resolveWorkspacePath(csvDir),
    DRIVE_CSV_SNAPSHOT_FILE,
  );
  const snapshot = normalizeSnapshot({
    schemaVersion: 1,
    folderId,
    capturedAt: new Date().toISOString(),
    files: downloads,
  });
  const serializable = {
    ...snapshot,
    files: snapshot.files.map((file) => ({
      id: file.id,
      name: file.name,
      localName: file.localName,
      modifiedTime: file.modifiedTime,
      ...(file.mimeType ? { mimeType: file.mimeType } : {}),
      ...(file.size !== undefined ? { size: file.size } : {}),
    })),
  };

  await writeFile(
    snapshotPath,
    `${JSON.stringify(serializable, null, 2)}\n`,
    "utf8",
  );
  return snapshot;
}

export async function readDriveCsvSnapshot(csvDir) {
  const snapshotPath = path.join(
    resolveWorkspacePath(csvDir),
    DRIVE_CSV_SNAPSHOT_FILE,
  );

  try {
    return normalizeSnapshot(JSON.parse(await readFile(snapshotPath, "utf8")));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw new Error(
      `Falha ao ler ${DRIVE_CSV_SNAPSHOT_FILE}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
