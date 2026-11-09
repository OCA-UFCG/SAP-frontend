/**
 * Marca de que a abertura já tocou nesta sessão do navegador. É um cookie, e
 * não o `sessionStorage`, porque quem decide se ela aparece é o servidor: assim
 * ela já vem (ou não vem) no HTML, sem piscar quando a pessoa recarrega a
 * página. Sem `Max-Age`, o navegador o apaga ao fechar.
 */
export const PLATFORM_INTRO_COOKIE = "sedes_platform_intro_seen";

const DONE_EVENT = "sedes:platform-intro-done";

let playing = false;

export function hasSeenPlatformIntro() {
  return document.cookie
    .split("; ")
    .some((entry) => entry.startsWith(`${PLATFORM_INTRO_COOKIE}=`));
}

/** Marca ao começar, não ao terminar: quem recarrega no meio não vê de novo. */
export function startPlatformIntro() {
  document.cookie = `${PLATFORM_INTRO_COOKIE}=1; path=/; SameSite=Lax`;
  playing = true;
}

export function finishPlatformIntro() {
  if (!playing) return;
  playing = false;
  window.dispatchEvent(new Event(DONE_EVENT));
}

/**
 * Chama `callback` quando a abertura terminar, ou na hora se ela não estiver
 * tocando. Devolve a função que desiste da espera.
 *
 * @example
 * useEffect(() => afterPlatformIntro(() => startTour()), []);
 */
export function afterPlatformIntro(callback: () => void) {
  if (!playing) {
    callback();
    return () => {};
  }

  window.addEventListener(DONE_EVENT, callback, { once: true });
  return () => window.removeEventListener(DONE_EVENT, callback);
}
