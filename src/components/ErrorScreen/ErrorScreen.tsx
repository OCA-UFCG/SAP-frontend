import type { ReactNode } from "react";

interface ErrorScreenProps {
  title: string;
  description: string;
  /** Linha discreta abaixo da descrição, usada para o digest do erro. */
  note?: string;
  actions: ReactNode;
}

/**
 * Moldura das telas de falha da plataforma (erro inesperado e página não
 * encontrada). Recebe texto já traduzido em vez de chamar `useTranslations`
 * porque as duas telas que a usam vivem em ambientes diferentes: `error.tsx` é
 * um componente de cliente e `not-found.tsx` é de servidor.
 *
 * <ErrorScreen title={t("title")} description={t("description")} actions={...} />
 */
export function ErrorScreen({
  title,
  description,
  note,
  actions,
}: ErrorScreenProps) {
  return (
    <section className="flex w-full flex-1 flex-col items-center justify-center bg-white px-6 py-16">
      <div className="flex w-full max-w-[656px] flex-col items-center gap-6 text-center">
        <span
          aria-hidden="true"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-[#E1E2B4] text-[32px] font-bold text-[#777E32]"
        >
          !
        </span>

        <h1 className="text-[28px] leading-[130%] font-bold text-[#777E32] lg:text-[32px]">
          {title}
        </h1>

        <p className="text-[16px] leading-[150%] text-neutral-700 lg:text-[18px]">
          {description}
        </p>

        {note ? (
          <p className="font-mono text-[13px] text-neutral-500">{note}</p>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
          {actions}
        </div>
      </div>
    </section>
  );
}
