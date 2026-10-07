"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/translations/routing";
import { ErrorScreen } from "@/components/ErrorScreen/ErrorScreen";
import {
  PRIMARY_ACTION_CLASS,
  SECONDARY_ACTION_CLASS,
} from "@/components/ErrorScreen/errorScreenActionStyles";

/**
 * Fronteira de erro das páginas de dentro de um locale. Cobre a falha mais
 * comum do produto: o Contentful ou o Earth Engine não responderem enquanto uma
 * página de servidor é montada. Sem ela o visitante recebe a tela padrão do
 * Next, em inglês e sem como tentar de novo.
 *
 * Não cobre `[locale]/layout.tsx`: o erro de um layout sobe para a fronteira
 * acima dele, que é `app/global-error.tsx`.
 */
export default function LocaleErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("ErrorPage");

  useEffect(() => {
    // O digest é a única ponte entre o que o visitante vê e a linha no log do
    // servidor, onde a mensagem real fica.
    console.error(
      `[errorBoundary] falha ao renderizar a página${error.digest ? ` (digest: ${error.digest})` : ""}`,
      error,
    );
  }, [error]);

  return (
    <ErrorScreen
      title={t("unexpected.title")}
      description={t("unexpected.description")}
      note={
        error.digest
          ? t("unexpected.digest", { digest: error.digest })
          : undefined
      }
      actions={
        <>
          <button
            type="button"
            onClick={reset}
            className={PRIMARY_ACTION_CLASS}
          >
            {t("unexpected.retry")}
          </button>
          <Link href="/" className={SECONDARY_ACTION_CLASS}>
            {t("unexpected.home")}
          </Link>
        </>
      }
    />
  );
}
