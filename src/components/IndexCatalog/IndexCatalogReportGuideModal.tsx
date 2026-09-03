"use client";

import { useEffect } from "react";
import {
  CATALOG_REPORT_VARIABLES,
  DEFAULT_CATALOG_REPORT_SECTIONS,
} from "@/config/indexCatalogReportText";

/**
 * Um exemplo pronto de seção, com o texto escrito de um lado e o resultado do
 * outro. O par lado a lado é o ponto do guia: a dúvida de quem escreve não é o
 * que a variável significa, é como a frase sai depois de trocada.
 */
const SECTION_EXAMPLES: ReadonlyArray<{
  title: string;
  written: string;
  rendered: string;
}> = [
  {
    title: "Situação atual",
    written:
      "Em [municipio] — [uf], a classe predominante deste índice é [classe], que responde por [percentual]% da área do município no período de [periodo_extenso].",
    rendered:
      "Em Campina Grande — PB, a classe predominante deste índice é Semiárido, que responde por 83,4% da área do município no período de setembro de 2024.",
  },
  {
    title: "Como interpretar os resultados",
    written:
      "Uma parcela de [percentual]% em [classe] indica que a maior parte do território de [municipio] esteve nessa faixa em [periodo_extenso], o que não exclui a presença de áreas mais críticas.",
    rendered:
      "Uma parcela de 83,4% em Semiárido indica que a maior parte do território de Campina Grande esteve nessa faixa em setembro de 2024, o que não exclui a presença de áreas mais críticas.",
  },
];

function GuideExample({
  title,
  written,
  rendered,
}: {
  title: string;
  written: string;
  rendered: string;
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-[#757B35]">
        {title}
      </p>
      <p className="mt-2 text-xs font-semibold text-stone-700">
        O que você escreve
      </p>
      <code className="mt-1 block rounded-md border border-stone-300 bg-white px-3 py-2 text-xs leading-relaxed text-stone-900">
        {written}
      </code>
      <p className="mt-3 text-xs font-semibold text-stone-700">
        Como o cidadão lê
      </p>
      <p className="mt-1 rounded-md border border-[#D6D89A] bg-[#F4F5D8] px-3 py-2 text-xs leading-relaxed text-stone-900">
        {rendered}
      </p>
    </div>
  );
}

export function IndexCatalogReportGuideModal({
  onClose,
}: {
  onClose: () => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[140] grid place-items-center bg-black/50 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-report-guide-title"
        className="max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-stone-200 pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#757B35]">
              Ajuda do Relatório Automático
            </p>
            <h2
              id="catalog-report-guide-title"
              className="mt-1 text-xl font-bold"
            >
              Como escrever o texto deste índice
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-stone-600">
              O relatório monta sozinho o mapa, a tabela de classes e o gráfico
              da série. O que você escreve aqui é a parte em palavras: o que o
              índice mede, como interpretar o número e o que ele não responde.
            </p>
          </div>
          <button
            type="button"
            className="cursor-pointer rounded-md px-3 py-1 text-xl font-bold hover:bg-stone-100"
            aria-label="Fechar ajuda do relatório"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <h3 className="mt-5 font-bold">Duas regras que mudam o resultado</h3>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed text-stone-700">
          <li>
            A seção chamada <strong>“Situação atual”</strong> substitui a frase
            que o relatório escreveria sozinho. As outras seções entram depois,
            no bloco de análise, cada uma com o seu título em negrito.
          </li>
          <li>
            Uma seção sem texto não vira seção vazia: ela desaparece do
            relatório. É assim que você tira uma parte sem perder as outras.
          </li>
        </ul>

        <h3 className="mt-5 font-bold">Exemplos prontos</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {SECTION_EXAMPLES.map((example) => (
            <GuideExample key={example.title} {...example} />
          ))}
        </div>

        <h3 className="mt-5 font-bold">Dados que você pode inserir</h3>
        <p className="mt-1 text-sm text-stone-600">
          Escreva o nome entre colchetes. O servidor troca pelo dado do
          município no momento em que o relatório é gerado.
        </p>
        <div className="mt-3 overflow-hidden rounded-lg border border-stone-200">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-stone-100 text-left">
              <tr>
                <th className="px-3 py-2 font-semibold">Escreva</th>
                <th className="px-3 py-2 font-semibold">O que entra</th>
                <th className="px-3 py-2 font-semibold">
                  Exemplo em Campina Grande
                </th>
              </tr>
            </thead>
            <tbody>
              {CATALOG_REPORT_VARIABLES.map((variable) => (
                <tr key={variable.token} className="border-t border-stone-200">
                  <td className="px-3 py-2 font-mono text-xs">
                    {variable.token}
                  </td>
                  <td className="px-3 py-2 text-stone-700">
                    {variable.description}
                  </td>
                  <td className="px-3 py-2 text-stone-900">
                    {variable.example}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-stone-500">
          <code>[classe]</code>, <code>[percentual]</code> e{" "}
          <code>[periodo]</code> sempre se referem a <em>este</em> índice, não
          aos outros do relatório. Um nome que não esteja nesta tabela fica
          escrito com os colchetes no relatório final.
        </p>

        <h3 className="mt-5 font-bold">O texto padrão</h3>
        <p className="mt-1 text-sm leading-relaxed text-stone-600">
          Um índice novo já chega com {DEFAULT_CATALOG_REPORT_SECTIONS.length}{" "}
          seções preenchidas —{" "}
          {DEFAULT_CATALOG_REPORT_SECTIONS.map((section) => section.title).join(
            ", ",
          )}{" "}
          — escritas de forma genérica mas correta para qualquer índice. Se você
          não editar nada, é esse texto que será publicado. O botão “Restaurar o
          texto padrão” traz tudo de volta se você quiser começar de novo.
        </p>

        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
          <strong>Atenção:</strong> o relatório lê a versão publicada do índice.
          Ao editar o texto de um índice que já está publicado, salve e{" "}
          <strong>publique de novo</strong> — só então o novo texto aparece no
          relatório.
        </div>

        <footer className="mt-6 flex justify-end border-t border-stone-200 pt-4">
          <button
            type="button"
            className="cursor-pointer rounded-md bg-[#292829] px-4 py-2 text-sm font-semibold text-white"
            onClick={onClose}
          >
            Entendi
          </button>
        </footer>
      </section>
    </div>
  );
}
