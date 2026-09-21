/** Id de arquivo do Google Drive: o trecho opaco que aparece depois de `/d/`. */
const DRIVE_FILE_ID_PATTERN = /^[A-Za-z0-9_-]{16,}$/u;

const FILE_ID_IN_PATH = /\/d\/([A-Za-z0-9_-]{16,})/u;

/**
 * O id do arquivo dentro de um link do Google.
 *
 * Aceita as três formas que o operador encontra no botão "Compartilhar" — a do
 * Planilhas, a do Drive e a de `open?id=` — e também o id puro, porque quem já
 * conhece o id costuma colar só ele.
 *
 * @example
 * parseGoogleFileId("https://docs.google.com/spreadsheets/d/1OgW6thfyXJX1TlW225BwNg4qvpXHzYAu/edit?usp=drive_link");
 * // "1OgW6thfyXJX1TlW225BwNg4qvpXHzYAu"
 */
export function parseGoogleFileId(rawLink: string): string {
  const link = String(rawLink ?? "").trim();

  if (!link) {
    throw new Error("Cole o link da planilha do Google.");
  }
  if (DRIVE_FILE_ID_PATTERN.test(link) && !link.includes("/")) {
    return link;
  }

  const fromPath = link.match(FILE_ID_IN_PATH)?.[1];
  if (fromPath) return fromPath;

  const fromQuery = link.match(/[?&]id=([A-Za-z0-9_-]{16,})/u)?.[1];
  if (fromQuery) return fromQuery;

  throw new Error(
    `Não consegui achar o id do arquivo no link "${link}". Use o link que o botão Compartilhar do Google gera, no formato https://docs.google.com/spreadsheets/d/<id>/edit.`,
  );
}

/**
 * Os endereços de download de uma planilha, na ordem em que vale tentar.
 *
 * São dois porque o Drive guarda dois tipos de arquivo sob o mesmo tipo de
 * link: uma planilha nativa do Google só sai pela rota `export`, e um `.xlsx`
 * que alguém subiu só sai pela rota de download binário. Tentar as duas evita
 * pedir ao operador que saiba qual dos dois ele tem.
 */
export function buildSpreadsheetDownloadUrls(fileId: string): string[] {
  return [
    `https://docs.google.com/spreadsheets/d/${fileId}/export?format=xlsx`,
    `https://drive.google.com/uc?export=download&id=${fileId}`,
  ];
}
