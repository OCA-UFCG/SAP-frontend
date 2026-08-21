/**
 * Contrato do PNG que o navegador captura do mapa na validação do catálogo e
 * envia como data URL. A validação roda antes de qualquer escrita: uma captura
 * corrompida ou grande demais não pode virar asset no Contentful.
 */
export const PREVIEW_MAP_DATA_URL_PREFIX = "data:image/png;base64,";
export const PREVIEW_MAP_MAX_BYTES = 4 * 1024 * 1024;

/** Assinatura de 8 bytes que abre todo arquivo PNG (RFC 2083, seção 3.1). */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export interface DecodedPreviewMapImage {
  /** Uint8Array<ArrayBuffer> para poder ir direto no corpo de um fetch. */
  bytes: Uint8Array<ArrayBuffer>;
  contentType: "image/png";
  fileName: string;
}

export function buildPreviewMapFileName(panelLayerId: string) {
  return `${panelLayerId}-previa-mapa.png`;
}

function hasPngSignature(bytes: Uint8Array<ArrayBuffer>) {
  return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
}

/**
 * Converte a data URL capturada no navegador em bytes validados.
 *
 * @example
 * const image = decodePreviewMapDataUrl(body.image, "indice-aridez");
 * await upload(image.bytes, image.fileName);
 */
export function decodePreviewMapDataUrl(
  value: unknown,
  panelLayerId: string,
): DecodedPreviewMapImage {
  if (
    typeof value !== "string" ||
    !value.startsWith(PREVIEW_MAP_DATA_URL_PREFIX)
  ) {
    throw new Error(
      `Imagem de prévia inválida: informe uma data URL começando com "${PREVIEW_MAP_DATA_URL_PREFIX}" (recebido: ${typeof value === "string" ? `${value.slice(0, 32)}…` : typeof value}).`,
    );
  }

  const decoded = Buffer.from(
    value.slice(PREVIEW_MAP_DATA_URL_PREFIX.length),
    "base64",
  );
  const bytes = new Uint8Array(decoded.byteLength);
  bytes.set(decoded);

  if (!hasPngSignature(bytes)) {
    throw new Error(
      `Imagem de prévia inválida: os bytes recebidos (${bytes.byteLength}) não começam com a assinatura PNG. Capture o mapa novamente.`,
    );
  }

  if (bytes.byteLength > PREVIEW_MAP_MAX_BYTES) {
    throw new Error(
      `Imagem de prévia grande demais: ${bytes.byteLength} bytes, o máximo é ${PREVIEW_MAP_MAX_BYTES}.`,
    );
  }

  return {
    bytes,
    contentType: "image/png",
    fileName: buildPreviewMapFileName(panelLayerId),
  };
}
