"use client";

import Script from "next/script";
import {
  startVLibrasWidget,
  VLIBRAS_SCRIPT_URL,
  type VLibrasHost,
} from "@/lib/vlibras";

/**
 * O botão do VLibras, que traduz o texto da página para Libras (LBI, arts. 63
 * e 67). Carrega só depois do resto da página (`lazyOnload`): é um recurso de
 * apoio e não pode atrasar o mapa.
 *
 * @example
 * <body>...<VLibras /></body>
 */
export const VLibras = () => (
  <Script
    id="vlibras-plugin"
    src={VLIBRAS_SCRIPT_URL}
    strategy="lazyOnload"
    onLoad={() => startVLibrasWidget(window as VLibrasHost)}
  />
);
