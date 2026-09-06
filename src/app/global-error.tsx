"use client";

import { useEffect } from "react";

/**
 * Último recurso: só é renderizado quando o próprio `[locale]/layout.tsx`
 * falha — na prática, quando o Contentful não responde o conteúdo do rodapé.
 * Nesse ponto não existe `NextIntlClientProvider`, então o texto fica em
 * português (o locale padrão) e o estilo é inline, para a tela continuar
 * legível mesmo se a folha de estilo não tiver carregado.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      `[globalError] falha ao renderizar o layout raiz${error.digest ? ` (digest: ${error.digest})` : ""}`,
      error,
    );
  }, [error]);

  return (
    <html lang="pt">
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
              color: "#777E32",
            }}
          >
            O Portal SEDES está fora do ar no momento
          </h1>
          <p style={{ margin: "0 0 24px", fontSize: "16px", lineHeight: 1.5 }}>
            Não conseguimos carregar a estrutura da página. Tente de novo em
            alguns instantes.
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
              Código do erro: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              cursor: "pointer",
              border: "none",
              borderRadius: "2px",
              backgroundColor: "#777E32",
              color: "#ffffff",
              fontSize: "16px",
              fontWeight: 500,
              padding: "12px 24px",
            }}
          >
            Tentar de novo
          </button>
        </main>
      </body>
    </html>
  );
}
