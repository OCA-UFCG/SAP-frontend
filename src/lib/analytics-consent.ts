/**
 * A escolha da pessoa sobre o Google Analytics. O Analytics grava cookies e
 * manda ao Google dados da visita (inclusive o IP), então só carrega depois de
 * um "Aceitar" (LGPD, art. 7º, I). A escolha fica no `localStorage`, que não
 * sai do navegador.
 */
export type AnalyticsConsent = "granted" | "denied";

export const ANALYTICS_CONSENT_KEY = "sedes.analyticsConsent.v1";

const CHANGE_EVENT = "sedes:analytics-consent-change";
const REOPEN_EVENT = "sedes:cookie-preferences";

// Sem acesso ao armazenamento (aba anônima de alguns navegadores), a escolha
// vale até recarregar a página, em vez de o aviso não fechar.
let unsavedConsent: AnalyticsConsent | null = null;

export function readAnalyticsConsent(): AnalyticsConsent | null {
  try {
    const saved = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
    return saved === "granted" || saved === "denied" ? saved : null;
  } catch {
    return unsavedConsent;
  }
}

export function saveAnalyticsConsent(consent: AnalyticsConsent) {
  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, consent);
  } catch {
    // Vale até recarregar; o aviso volta na próxima visita.
    unsavedConsent = consent;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Para o `useSyncExternalStore`: avisa quando a escolha muda, inclusive em outra aba. */
export function subscribeAnalyticsConsent(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** O link "Cookies" do rodapé reabre o aviso para a pessoa mudar de ideia. */
export function openCookiePreferences() {
  window.dispatchEvent(new Event(REOPEN_EVENT));
}

export function onCookiePreferencesRequested(open: () => void) {
  window.addEventListener(REOPEN_EVENT, open);
  return () => window.removeEventListener(REOPEN_EVENT, open);
}

/**
 * Apaga os cookies `_ga*`. O Analytics os grava no domínio mais alto que
 * aceitar (`.oca-portal.com`, e não `sap.oca-portal.com`), então tenta cada
 * nível do endereço.
 */
export function clearAnalyticsCookies() {
  const names = document.cookie
    .split(";")
    .map((cookie) => cookie.split("=")[0].trim())
    .filter((name) => name.startsWith("_ga"));
  const labels = window.location.hostname.split(".");

  for (const name of names) {
    document.cookie = `${name}=; Max-Age=0; path=/`;
    for (let i = 0; i < labels.length - 1; i += 1) {
      const domain = labels.slice(i).join(".");
      document.cookie = `${name}=; Max-Age=0; path=/; domain=.${domain}`;
    }
  }
}
