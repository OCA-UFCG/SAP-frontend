"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { GoogleAnalytics } from "@next/third-parties/google";
import {
  type AnalyticsConsent,
  clearAnalyticsCookies,
  onCookiePreferencesRequested,
  readAnalyticsConsent,
  saveAnalyticsConsent,
  subscribeAnalyticsConsent,
} from "@/lib/analytics-consent";

// "Aceitar" e "Recusar" com o mesmo peso: destacar só o "Aceitar" empurra a
// pessoa para ele, e o consentimento deixa de ser livre.
const CHOICE_BUTTON =
  "font-open-sans flex h-[33px] flex-1 cursor-pointer items-center justify-center rounded-md border border-[#646B2D] px-3 py-1.5 text-[0.8125rem] font-medium leading-5 text-[#646B2D] transition hover:bg-[#646B2D] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B612A] focus-visible:ring-offset-2";

/**
 * O aviso de cookies e o Google Analytics, que só carrega depois do "Aceitar".
 * Antes da escolha, e depois de um "Recusar", nada é enviado ao Google.
 */
export function CookieConsent({ gaId }: { gaId: string }) {
  const t = useTranslations("CookieConsent");
  // No servidor a escolha é desconhecida (`undefined`): nem o aviso nem o
  // Analytics aparecem, para quem já escolheu não ver o aviso piscar.
  const consent = useSyncExternalStore(
    subscribeAnalyticsConsent,
    readAnalyticsConsent,
    () => undefined,
  );
  const [reopened, setReopened] = useState(false);

  useEffect(() => onCookiePreferencesRequested(() => setReopened(true)), []);

  const choose = (choice: AnalyticsConsent) => {
    setReopened(false);

    if (consent === "granted" && choice === "denied") {
      saveAnalyticsConsent(choice);
      // O script do Google já está na página e não tem como ser descarregado.
      // Desligado, ele não manda o último evento ao sair da página, que
      // gravaria o cookie de novo depois de apagado.
      (window as unknown as Record<string, boolean>)[`ga-disable-${gaId}`] =
        true;
      clearAnalyticsCookies();
      window.location.reload();
      return;
    }

    saveAnalyticsConsent(choice);
  };

  const showNotice = consent === null || (consent !== undefined && reopened);

  return (
    <>
      {consent === "granted" && <GoogleAnalytics gaId={gaId} />}
      {showNotice && (
        <section
          aria-labelledby="cookie-consent-title"
          className="fixed inset-x-4 bottom-4 z-50 flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-4 shadow-[0_16px_32px_rgba(33,36,15,0.14)] sm:right-auto sm:max-w-[26rem]"
        >
          <h2
            id="cookie-consent-title"
            className="font-inter text-[0.9375rem] font-medium leading-6 text-[#50554C]"
          >
            {t("title")}
          </h2>
          <p className="text-[0.8125rem] leading-5 text-[#676264]">
            {t("body")}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => choose("granted")}
              className={CHOICE_BUTTON}
            >
              {t("accept")}
            </button>
            <button
              type="button"
              onClick={() => choose("denied")}
              className={CHOICE_BUTTON}
            >
              {t("decline")}
            </button>
          </div>
        </section>
      )}
    </>
  );
}
