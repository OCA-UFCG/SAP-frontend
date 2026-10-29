"use client";

/* eslint-disable @next/next/no-img-element -- ver o comentário de ReportCover. */

import { useTranslations } from "next-intl";

/**
 * Logos do rodapé da capa, em duas linhas como no Figma. Tamanhos em pt, a
 * unidade do quadro do Figma (595 × 842 = A4 em pontos).
 */
const PARTNER_ROWS = [
  [
    { name: "Ministério do Meio Ambiente e Mudança do Clima", src: "mma.png", width: 94.17, height: 20.25 },
    { name: "Universidade Federal de Campina Grande", src: "ufcg.png", width: 94.17, height: 29.56 },
    { name: "Observatório da Caatinga e Desertificação", src: "oca.svg", width: 56.4, height: 28.78 },
    { name: "Agência Nacional de Águas e Saneamento Básico", src: "ana.png", width: 58, height: 28 },
    { name: "Instituto Nacional de Meteorologia", src: "inmet.png", width: 28.78, height: 28.78, rounded: true },
  ],
  [
    { name: "Instituto Brasileiro de Geografia e Estatística", src: "ibge.png", width: 96, height: 26 },
    { name: "Embrapa", src: "embrapa.png", width: 64, height: 24 },
    { name: "Instituto Nacional do Semiárido", src: "insa.png", width: 67, height: 24 },
    { name: "Defesa Civil Nacional", src: "defesa-civil.png", width: 28, height: 28 },
    { name: "Instituto Nacional de Pesquisas Espaciais", src: "inpe.png", width: 30, height: 30 },
  ],
];

/**
 * Capa do PDF do relatório. Só existe na impressão: na prévia da tela o
 * relatório continua abrindo pelo cabeçalho. Ocupa a folha inteira, sem as
 * margens das outras páginas (`@page report-cover` em `reportPrint.ts`).
 *
 * Os logos são `<img>` comuns, e não `next/image`: o `loading="lazy"` dele não
 * carrega imagem escondida, e a janela de impressão só espera o que já pediu.
 */
export function ReportCover() {
  const t = useTranslations("MunicipalReport");

  return (
    <section
      aria-label={t("document.coverTitle")}
      className="report-cover font-open-sans relative hidden h-[297mm] w-[210mm] overflow-hidden bg-[#4A4E26] print:block"
    >
      <svg
        aria-hidden="true"
        className="absolute inset-0 size-full"
        viewBox="0 0 595 842"
        preserveAspectRatio="none"
      >
        <path
          d="M205 0Q380 30 595 92V380C300 385 150 470 0 607V0Z"
          fill="#989F43"
        />
      </svg>
      <img
        alt=""
        src="/report-cover/sedes-symbol.svg"
        className="absolute left-[307pt] top-[441pt] h-[256pt] w-[247.45pt] opacity-20"
      />

      <div className="absolute left-[49pt] top-[63pt] flex w-[515pt] flex-col items-start gap-[28pt] text-[#F8F7F8]">
        <img alt="SEDES" src="/logo-sedes.svg" className="h-[31pt] w-auto" />
        <p className="flex items-center gap-[5.5pt] text-[26pt] font-bold leading-[27pt]">
          <span aria-hidden="true" className="size-[11pt] rounded-full bg-white" />
          {t("document.coverEyebrow")}
          <span aria-hidden="true" className="size-[11pt] rounded-full bg-white" />
        </p>
        <p className="text-[49pt] font-bold leading-[53pt]">
          {t("document.coverTitle")}
        </p>
      </div>

      <div
        aria-label={t("document.coverPartners")}
        className="absolute bottom-0 left-0 flex h-[97pt] w-full flex-col items-center gap-[12pt] bg-[#F8F7ED] pt-[13pt]"
      >
        {PARTNER_ROWS.map((row, index) => (
          <div
            key={index}
            className={`flex items-center ${index === 0 ? "gap-[41pt]" : "gap-[53pt]"}`}
          >
            {row.map((partner) => (
              <img
                key={partner.src}
                alt={partner.name}
                src={`/report-cover/${partner.src}`}
                className={`object-contain ${partner.rounded ? "rounded-[5.9pt]" : ""}`}
                style={{ width: `${partner.width}pt`, height: `${partner.height}pt` }}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
