/**
 * Um PNG exportado de um canvas WebGL com conteúdo nunca é tão curto: valores
 * abaixo disso significam buffer vazio (contexto perdido, mapa sem render).
 */
export const MIN_CAPTURED_PNG_DATA_URL_LENGTH = 100;

export interface CapturableMap {
  getCanvas(): { toDataURL(type: string): string };
}

/**
 * Exporta o canvas de um mapa MapLibre como PNG, ou `null` quando a captura
 * falhou — canvas contaminado por tile sem CORS, contexto WebGL perdido ou
 * buffer vazio. Quem chama decide se tenta de novo.
 *
 * @example
 * const dataUrl = captureMapCanvasPng(map);
 * if (dataUrl) upload(dataUrl);
 */
export function captureMapCanvasPng(map: CapturableMap): string | null {
  try {
    const dataUrl = map.getCanvas().toDataURL("image/png");
    return dataUrl && dataUrl.length > MIN_CAPTURED_PNG_DATA_URL_LENGTH
      ? dataUrl
      : null;
  } catch {
    return null;
  }
}
