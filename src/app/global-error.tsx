"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { routing } from "@/translations/routing-config";
import { htmlLang } from "@/translations/htmlLang";

/** Sem `NextIntlClientProvider` aqui: os textos ficam no próprio arquivo. */
const TEXTS = {
  pt: {
    title: "O Portal SEDES está fora do ar no momento",
    description:
      "Não conseguimos carregar a estrutura da página. Tente de novo em alguns instantes.",
    digest: "Código do erro:",
    retry: "Tentar de novo",
  },
  en: {
    title: "The SEDES Portal is down at the moment",
    description:
      "We could not load the page structure. Please try again in a few moments.",
    digest: "Error code:",
    retry: "Try again",
  },
  es: {
    title: "El Portal SEDES está fuera de servicio en este momento",
    description:
      "No pudimos cargar la estructura de la página. Inténtalo de nuevo en unos instantes.",
    digest: "Código del error:",
    retry: "Intentar de nuevo",
  },
} as const;

/**
 * Último recurso: só é renderizado quando o próprio `[locale]/layout.tsx`
 * falha — na prática, quando o Contentful não responde o conteúdo do rodapé.
 * Nesse ponto não existe `NextIntlClientProvider`, então o idioma sai do
 * começo da URL (`/en/...`) e o estilo é inline, para a tela continuar
 * legível mesmo se a folha de estilo não tiver carregado.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const prefix = usePathname()?.split("/")[1] ?? "";
  const locale = (routing.locales as readonly string[]).includes(prefix)
    ? (prefix as keyof typeof TEXTS)
    : routing.defaultLocale;
  const text = TEXTS[locale];

  useEffect(() => {
    console.error(
      `[globalError] falha ao renderizar o layout raiz${error.digest ? ` (digest: ${error.digest})` : ""}`,
      error,
    );
  }, [error]);

  return (
    <html lang={htmlLang(locale)}>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          backgroundColor: "#ffffff",
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "#404040",
        }}
      >
        <main style={{ maxWidth: "560px", textAlign: "center" }}>
          <h1
            style={{
              margin: "0 0 16px",
              fontSize: "28px",
              lineHeight: 1.3,
              color: "#5B612A",
            }}
          >
            {text.title}
          </h1>
          <p style={{ margin: "0 0 24px", fontSize: "16px", lineHeight: 1.5 }}>
            {text.description}
          </p>
          {error.digest ? (
            <p
              style={{
                margin: "0 0 24px",
                fontSize: "13px",
                color: "#737373",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              {text.digest} {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              cursor: "pointer",
              border: "none",
              borderRadius: "2px",
              backgroundColor: "#5B612A",
              color: "#ffffff",
              fontSize: "16px",
              fontWeight: 500,
              padding: "12px 24px",
            }}
          >
            {text.retry}
          </button>
        </main>
      </body>
    </html>
  );
}
