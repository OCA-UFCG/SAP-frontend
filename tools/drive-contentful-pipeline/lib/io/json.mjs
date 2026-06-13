import { readFile } from "node:fs/promises";
import path from "node:path";

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export function resolveManifestPath(jsonDir, fileName) {
  return path.join(jsonDir, fileName);
}
