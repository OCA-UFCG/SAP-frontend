import "server-only";

import { createSign } from "node:crypto";
import type {
  DriveFileCandidate,
  DriveSourceSelection,
} from "@/types/indexCatalog";
import { fileNameMatchesCatalogTag } from "@/utils/indexCatalog";
import { inspectCatalogCsvRows } from "@/utils/indexCatalogDrive";
import pipelineConfig from "../../../tools/drive-contentful-pipeline/config/pipeline-config.json";
import { toRows } from "../../../tools/drive-contentful-pipeline/lib/csv/csv-parser.mjs";

const DRIVE_API_BASE_URL = "https://www.googleapis.com/drive/v3";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const GOOGLE_SHEETS_MIME_TYPE = "application/vnd.google-apps.spreadsheet";
const CSV_MIME_TYPES = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  GOOGLE_SHEETS_MIME_TYPE,
]);

interface DriveApiFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  parents?: string[];
}

let accessTokenCache:
  | {
      identity: string;
      value: string;
      expiresAt: number;
    }
  | undefined;

function getDriveFolderId() {
  return (
    process.env.GOOGLE_DRIVE_FOLDER_ID?.trim() || pipelineConfig.drive.folderId
  );
}

function decodeDrivePrivateKey() {
  if (process.env.GOOGLE_DRIVE_PRIVATE_KEY_BASE64) {
    return Buffer.from(
      process.env.GOOGLE_DRIVE_PRIVATE_KEY_BASE64,
      "base64",
    ).toString("utf8");
  }

  return process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/gu, "\n");
}

function createServiceAccountAssertion(email: string, privateKey: string) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/drive.readonly",
      aud: GOOGLE_TOKEN_URL,
      iat: issuedAt,
      exp: issuedAt + 3600,
    }),
  ).toString("base64url");
  const unsigned = `${header}.${payload}`;
  const signature = createSign("RSA-SHA256")
    .update(unsigned)
    .end()
    .sign(privateKey, "base64url");

  return `${unsigned}.${signature}`;
}

async function getDriveAccessToken() {
  if (process.env.GOOGLE_DRIVE_ACCESS_TOKEN) {
    return process.env.GOOGLE_DRIVE_ACCESS_TOKEN;
  }

  const email = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const privateKey = decodeDrivePrivateKey();

  if (!email || !privateKey) {
    throw new Error(
      "Configure GOOGLE_DRIVE_CLIENT_EMAIL e GOOGLE_DRIVE_PRIVATE_KEY_BASE64 para usar o catálogo.",
    );
  }

  const identity = email.trim().toLocaleLowerCase("en-US");
  if (
    accessTokenCache?.identity === identity &&
    accessTokenCache.expiresAt > Date.now() + 60_000
  ) {
    return accessTokenCache.value;
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: createServiceAccountAssertion(email, privateKey),
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };

  if (!response.ok || !body.access_token) {
    throw new Error(
      `Falha ao autenticar no Drive: ${body.error_description ?? response.status}.`,
    );
  }

  accessTokenCache = {
    identity,
    value: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
  return body.access_token;
}

async function driveFetch<T>(url: URL, context: string): Promise<T> {
  const accessToken = await getDriveAccessToken();
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `${context} falhou com status ${response.status}: ${text.slice(0, 500)}`,
    );
  }

  return JSON.parse(text) as T;
}

async function assertConfiguredFolderAccessible() {
  const folderId = getDriveFolderId();
  const url = new URL(
    `${DRIVE_API_BASE_URL}/files/${encodeURIComponent(folderId)}`,
  );
  url.searchParams.set("fields", "id,name,mimeType,trashed");
  url.searchParams.set("supportsAllDrives", "true");

  let folder: DriveApiFile & { trashed?: boolean };
  try {
    folder = await driveFetch<DriveApiFile & { trashed?: boolean }>(
      url,
      "Validação da pasta configurada do Drive",
    );
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Erro inesperado no Drive.";
    if (/status (?:403|404)\b/u.test(reason)) {
      throw new Error(
        "A conta de serviço não consegue acessar a pasta configurada do Drive. Compartilhe a pasta com GOOGLE_DRIVE_CLIENT_EMAIL e tente novamente.",
      );
    }
    throw new Error(
      `Não foi possível validar o acesso à pasta configurada do Drive. ${reason}`,
    );
  }

  if (folder.trashed || folder.mimeType !== GOOGLE_DRIVE_FOLDER_MIME_TYPE) {
    throw new Error(
      "GOOGLE_DRIVE_FOLDER_ID não aponta para uma pasta ativa do Drive.",
    );
  }
}

async function listConfiguredFolderFiles() {
  await assertConfiguredFolderAccessible();

  const files: DriveApiFile[] = [];
  let pageToken = "";

  do {
    const url = new URL(`${DRIVE_API_BASE_URL}/files`);
    url.searchParams.set(
      "q",
      `'${getDriveFolderId()}' in parents and trashed = false`,
    );
    url.searchParams.set(
      "fields",
      "nextPageToken,files(id,name,mimeType,modifiedTime,size,parents)",
    );
    url.searchParams.set("supportsAllDrives", "true");
    url.searchParams.set("includeItemsFromAllDrives", "true");
    url.searchParams.set("pageSize", "1000");
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const result = await driveFetch<{
      nextPageToken?: string;
      files?: DriveApiFile[];
    }>(url, "Listagem da pasta do Drive");
    files.push(...(result.files ?? []));
    pageToken = result.nextPageToken ?? "";
  } while (pageToken);

  return files;
}

function driveFileContentUrl(file: DriveApiFile) {
  if (file.mimeType === GOOGLE_SHEETS_MIME_TYPE) {
    const url = new URL(`${DRIVE_API_BASE_URL}/files/${file.id}/export`);
    url.searchParams.set("mimeType", "text/csv");
    return url;
  }

  const url = new URL(`${DRIVE_API_BASE_URL}/files/${file.id}`);
  url.searchParams.set("alt", "media");
  return url;
}

export async function downloadDriveFileText(file: DriveApiFile) {
  const accessToken = await getDriveAccessToken();
  const response = await fetch(driveFileContentUrl(file), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Download de ${file.name} falhou com status ${response.status}: ${text.slice(0, 500)}`,
    );
  }

  return response.text();
}

async function inspectDriveFile(
  file: DriveApiFile,
): Promise<DriveFileCandidate> {
  try {
    const rows = toRows(await downloadDriveFileText(file)) as Array<
      Record<string, string>
    >;

    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      modifiedTime: file.modifiedTime,
      ...(file.size ? { size: file.size } : {}),
      inspection: inspectCatalogCsvRows(rows),
    };
  } catch (error) {
    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      modifiedTime: file.modifiedTime,
      ...(file.size ? { size: file.size } : {}),
      inspection: {
        role: "unsupported",
        columns: [],
        periods: [],
        classColumns: [],
        warnings: [
          error instanceof Error ? error.message : "Falha ao inspecionar CSV.",
        ],
      },
    };
  }
}

export async function searchDriveFilesByTag(tag: string) {
  const normalizedTag = tag.trim();
  if (!normalizedTag) {
    throw new Error("Informe uma tag para pesquisar.");
  }
  if (normalizedTag.length > 100) {
    throw new Error("A tag deve ter no máximo 100 caracteres.");
  }

  const files = (await listConfiguredFolderFiles())
    .filter((file) => CSV_MIME_TYPES.has(file.mimeType))
    .filter((file) => fileNameMatchesCatalogTag(file.name, normalizedTag))
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"))
    .slice(0, 100);

  const results: DriveFileCandidate[] = [];
  for (let index = 0; index < files.length; index += 4) {
    results.push(
      ...(await Promise.all(
        files.slice(index, index + 4).map(inspectDriveFile),
      )),
    );
  }

  return results;
}

async function getDriveFileMetadata(fileId: string) {
  const url = new URL(
    `${DRIVE_API_BASE_URL}/files/${encodeURIComponent(fileId)}`,
  );
  url.searchParams.set(
    "fields",
    "id,name,mimeType,modifiedTime,size,parents,trashed",
  );
  url.searchParams.set("supportsAllDrives", "true");

  return driveFetch<DriveApiFile & { trashed?: boolean }>(
    url,
    `Leitura do arquivo ${fileId}`,
  );
}

export async function resolveSelectedDriveFiles(
  selectedFiles: DriveSourceSelection[],
) {
  await assertConfiguredFolderAccessible();

  const folderId = getDriveFolderId();
  const resolved: Array<{
    metadata: DriveApiFile;
    selected: DriveSourceSelection;
    text: string;
  }> = [];

  for (const selected of selectedFiles) {
    const metadata = await getDriveFileMetadata(selected.id);

    if (
      metadata.trashed ||
      !metadata.parents?.includes(folderId) ||
      !CSV_MIME_TYPES.has(metadata.mimeType)
    ) {
      throw new Error(
        `O arquivo ${selected.name} não está mais disponível na pasta configurada.`,
      );
    }
    if (metadata.modifiedTime !== selected.modifiedTime) {
      throw new Error(
        `O arquivo ${selected.name} foi alterado depois da seleção. Pesquise e valide novamente.`,
      );
    }

    resolved.push({
      metadata,
      selected,
      text: await downloadDriveFileText(metadata),
    });
  }

  return resolved;
}

export { getDriveFolderId };
