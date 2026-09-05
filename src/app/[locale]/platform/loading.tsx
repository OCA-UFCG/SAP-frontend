import { useTranslations } from "next-intl";

/**
 * Fallback de streaming do `/platform`. A página espera o `getPanelLayers` e a
 * verificação da sessão antes de emitir qualquer HTML; sem este arquivo a aba
 * fica em branco durante essa espera.
 */
export default function PlatformLoading() {
  const t = useTranslations("ErrorPage");

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex w-full flex-1 flex-col items-center justify-center gap-4 bg-white py-16"
    >
      <div
        aria-hidden="true"
        className="h-10 w-10 animate-spin rounded-full border-2 border-[#E1E2B4] border-t-[#777E32]"
      />
      <p className="text-[15px] text-neutral-600">{t("loading.platform")}</p>
    </div>
  );
}
