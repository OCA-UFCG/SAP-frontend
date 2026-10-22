/**
 * Interface fina sobre o VLibras, o tradutor para Libras do Governo Federal.
 * O resto do app só conhece estas constantes e `startVLibrasWidget`; se o
 * plugin mudar de forma de inicialização, a mudança fica aqui.
 *
 * Desde a 7.x o plugin desenha o próprio botão (num shadow DOM) assim que
 * carrega, sem as `<div vw>` das versões antigas. Chamar o `Widget` só fixa a
 * pasta de onde ele baixa o avatar, e repetir a chamada não duplica o botão.
 */
export const VLIBRAS_SCRIPT_URL = "https://vlibras.gov.br/app/vlibras-plugin.js";
export const VLIBRAS_APP_URL = "https://vlibras.gov.br/app";

type VLibrasWidgetConstructor = new (rootPath: string) => unknown;

/** O pedaço de `window` que o plugin preenche ao carregar. */
export interface VLibrasHost {
  VLibras?: { Widget?: VLibrasWidgetConstructor };
}

/**
 * Liga o widget depois que o script carregou. Devolve `false` se o script não
 * expôs o `Widget` (bloqueado por extensão, rede ou mudança no plugin), para
 * quem chama não quebrar a página por causa de um recurso opcional.
 *
 * @example
 * <Script src={VLIBRAS_SCRIPT_URL} onLoad={() => startVLibrasWidget(window)} />
 */
export function startVLibrasWidget(host: VLibrasHost): boolean {
  const Widget = host.VLibras?.Widget;
  if (typeof Widget !== "function") return false;

  new Widget(VLIBRAS_APP_URL);
  return true;
}
