"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { CommunicationReportSelection } from "@/components/SidePanelContexts/CommunicationContext";

interface CommunicationReportViewerProps {
  selection: CommunicationReportSelection;
}

const ZOOM_STEP = 10;
const MIN_ZOOM = 60;
const MAX_ZOOM = 120;

function sanitizePdfText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function createPdfStreamLine(text: string, size = 12) {
  return `/${size >= 18 ? "F2" : "F1"} ${size} Tf\n(${sanitizePdfText(text)}) Tj\n`;
}

function createPlaceholderPdf(selection: CommunicationReportSelection) {
  const selectedItems =
    selection.items.length > 0
      ? selection.items.join(", ")
      : "Nenhum modulo selecionado";
  const content = [
    "BT",
    "72 760 Td",
    createPdfStreamLine("Construindo relatorio", 22),
    "0 -36 Td",
    createPdfStreamLine(`Area: ${selection.area}`),
    "0 -22 Td",
    createPdfStreamLine(`Modulos: ${selectedItems}`),
    "0 -36 Td",
    createPdfStreamLine(
      "Este PDF temporario sera substituido pelo relatorio oficial.",
    ),
    "ET",
  ].join("\n");
  const contentLength = new TextEncoder().encode(content).length;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${contentLength} >>\nstream\n${content}\nendstream`,
  ];
  const encoder = new TextEncoder();
  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(encoder.encode(pdf).length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = encoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

export function CommunicationReportViewer({
  selection,
}: CommunicationReportViewerProps) {
  const t = useTranslations("CommunicationContext");
  const [zoom, setZoom] = useState(75);
  const fileName = t("viewer.fileName", {
    area: selection.area.replace(/\s+/g, "-"),
  });
  const pdfBlob = useMemo(() => createPlaceholderPdf(selection), [selection]);
  const pdfUrl = useMemo(() => URL.createObjectURL(pdfBlob), [pdfBlob]);
  const viewerUrl = pdfUrl ? `${pdfUrl}#page=1&zoom=${zoom}` : "";

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  return (
    <section className="flex h-full flex-col bg-[#A1A89D]">
      <div className="flex h-12 shrink-0 items-center gap-4 border-b border-neutral-300 bg-[#E4E5E2] px-6 font-inter text-sm text-[#292829]">
        <h2 className="min-w-0 flex-1 truncate font-medium">{fileName}</h2>

        <div className="flex items-center gap-2">
          <span className="rounded-md bg-white px-3 py-2 text-sm shadow-sm">
            1
          </span>
          <span>/ 1</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setZoom((current) => Math.max(MIN_ZOOM, current - ZOOM_STEP))
            }
            className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-[#989F43] shadow-sm transition hover:bg-[#F6F7F6]"
            aria-label={t("viewer.zoomOut")}
          >
            -
          </button>
          <span className="rounded-md bg-white px-3 py-2 text-sm shadow-sm">
            {zoom}%
          </span>
          <button
            type="button"
            onClick={() =>
              setZoom((current) => Math.min(MAX_ZOOM, current + ZOOM_STEP))
            }
            className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-[#989F43] shadow-sm transition hover:bg-[#F6F7F6]"
            aria-label={t("viewer.zoomIn")}
          >
            +
          </button>
        </div>

        <a
          href={pdfUrl || undefined}
          download={fileName}
          className="flex h-9 items-center rounded-md bg-[#989F43] px-4 text-sm font-medium text-white transition hover:bg-[#858c35]"
        >
          {t("viewer.download")}
        </a>
      </div>

      <div className="min-h-0 flex-1 p-6">
        {viewerUrl ? (
          <iframe
            key={viewerUrl}
            src={viewerUrl}
            title={fileName}
            className="h-full w-full border-0 bg-white shadow-xl"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-white font-inter text-sm text-[#292829]">
            {t("viewer.loading")}
          </div>
        )}
      </div>
    </section>
  );
}
