import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
  resolveWorkspacePath,
  toWorkspaceRelativePath,
} from "../shared/paths.mjs";

const DRIVE_API_BASE_URL = "https://www.googleapis.com/drive/v3";
const execFileAsync = promisify(execFile);

function withAuth(url, options) {
  if (options.apiKey && !options.accessToken) {
    url.searchParams.set("key", options.apiKey);
  }

  return {
    headers: options.accessToken
      ? { Authorization: `Bearer ${options.accessToken}` }
      : {},
  };
}

async function fetchJson(url, options) {
  const response = await fetch(url, withAuth(url, options));

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Falha ao consultar Google Drive (${response.status}): ${body}`,
    );
  }

  return response.json();
}

async function listDriveCsvFiles(options) {
  const files = [];
  let pageToken = "";

  do {
    const url = new URL(`${DRIVE_API_BASE_URL}/files`);
    url.searchParams.set(
      "q",
      `'${options.folderId}' in parents and trashed = false`,
    );
    url.searchParams.set(
      "fields",
      "nextPageToken,files(id,name,mimeType,modifiedTime,size)",
    );
    url.searchParams.set("supportsAllDrives", "true");
    url.searchParams.set("includeItemsFromAllDrives", "true");
    url.searchParams.set("pageSize", "1000");

    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const data = await fetchJson(url, options);

    for (const file of data.files ?? []) {
      const isCsvLike =
        file.mimeType === "text/csv" ||
        file.mimeType === "application/vnd.google-apps.spreadsheet";

      if (isCsvLike && options.fileNamePattern.test(file.name)) {
        files.push(file);
      }
    }

    pageToken = data.nextPageToken ?? "";
  } while (pageToken);

  return files.sort((left, right) => left.name.localeCompare(right.name));
}

async function downloadDriveFile(file, destinationDir, options) {
  const url =
    file.mimeType === "application/vnd.google-apps.spreadsheet"
      ? new URL(`${DRIVE_API_BASE_URL}/files/${file.id}/export`)
      : new URL(`${DRIVE_API_BASE_URL}/files/${file.id}`);

  if (file.mimeType === "application/vnd.google-apps.spreadsheet") {
    url.searchParams.set("mimeType", "text/csv");
  } else {
    url.searchParams.set("alt", "media");
  }

  const response = await fetch(url, withAuth(url, options));

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Falha ao baixar ${file.name} (${response.status}): ${body}`,
    );
  }

  const safeName = file.name.endsWith(".csv") ? file.name : `${file.name}.csv`;
  const outputPath = path.join(destinationDir, safeName);
  await writeFile(outputPath, Buffer.from(await response.arrayBuffer()));

  return outputPath;
}

async function getGcloudAccessToken() {
  try {
    const { stdout } = await execFileAsync("gcloud", [
      "auth",
      "print-access-token",
      "--scopes=https://www.googleapis.com/auth/drive",
    ]);
    const token = stdout.trim();

    if (!token) throw new Error("gcloud nao retornou token.");

    return token;
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);

    throw new Error(
      `Para baixar do Drive, informe GOOGLE_DRIVE_ACCESS_TOKEN ou GOOGLE_DRIVE_API_KEY, ou configure o gcloud com acesso ao Drive. Se aparecer invalid_scope, rode: gcloud auth login --enable-gdrive-access --force. Use --skip-download para converter CSVs locais. Detalhe: ${details}`,
    );
  }
}

export async function downloadCsvFiles(options) {
  if (!options.accessToken && !options.apiKey) {
    options.accessToken = await getGcloudAccessToken();
  }

  const csvDir = resolveWorkspacePath(options.csvDir);
  await mkdir(csvDir, { recursive: true });
  const files = await listDriveCsvFiles(options);

  if (files.length === 0) {
    throw new Error("Nenhum CSV encontrado na pasta do Google Drive.");
  }

  const downloads = [];

  for (const file of files) {
    const outputPath = await downloadDriveFile(file, csvDir, options);
    downloads.push({
      id: file.id,
      name: file.name,
      outputPath: toWorkspaceRelativePath(outputPath),
    });
  }

  return downloads;
}
