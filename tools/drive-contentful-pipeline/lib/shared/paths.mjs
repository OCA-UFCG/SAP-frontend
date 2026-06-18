import path from "node:path";

export function resolveWorkspacePath(value) {
  return path.resolve(process.cwd(), value);
}

export function toWorkspaceRelativePath(value) {
  return path.relative(process.cwd(), value);
}

export function slugifyFileName(fileName) {
  return path
    .basename(fileName, path.extname(fileName))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-zA-Z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .toLowerCase();
}
