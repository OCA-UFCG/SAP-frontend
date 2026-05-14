"use client";

import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import type { ImageDataConfig } from "@/utils/interfaces";
import {
  getImageDataLegend,
  getImageDataYearKeys,
  getImageDataDefaultYear,
  resolveImageYearEntry,
  isCompactImageData,
} from "@/utils/imageData";
import { IDroughtDataset } from "../DroughtDataset/DroughtDataset";

export interface IInfoModalProps {
  card: IDroughtDataset;
  imageData?: ImageDataConfig | null;
  open: boolean;
  onClose: () => void;
}

function CloseIcon() {
  return (
    <svg width="24" height="24" aria-hidden>
      <use href="/sprite.svg#close-modal" />
    </svg>
  );
}

function TableRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <tr className="border-t border-[#B4BA61] odd:bg-[#F0F0D7] even:bg-white">
      <td className="w-[180px] px-10 py-2 align-top font-inter text-[16px] font-medium leading-6 tracking-[-0.015em] text-black whitespace-pre-line">
        {label}
      </td>
      <td className="px-10 py-2 align-top font-inter text-[16px] font-normal leading-6 tracking-[-0.015em] text-[#4A4E26] whitespace-pre-line break-words">
        {children}
      </td>
    </tr>
  );
}

export function InfoModal({
  card,
  imageData,
  open,
  onClose,
}: IInfoModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const isCompact = isCompactImageData(imageData);
  const years = getImageDataYearKeys(imageData);
  const defaultYear = getImageDataDefaultYear(imageData);

  const currentYearData = useMemo(() => {
    if (!defaultYear) return null;
    return resolveImageYearEntry(imageData, defaultYear);
  }, [imageData, defaultYear]);

  const legend = getImageDataLegend(imageData);
  const type = isCompact ? imageData.type : "-";

  const palette = isCompact
    ? imageData.classes.map((item) => item.color.replace("#", "")).join(", ")
    : null;

  const maxValue = isCompact ? imageData.classes.length : 0;

  if (typeof document === "undefined" || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={`Informações sobre ${card.title}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        className="flex max-h-[90vh] w-full max-w-[1000px] flex-col overflow-hidden rounded-[12px] bg-white shadow-2xl"
      >
        <div className="shrink-0 border-b border-[#B4BA61]">
          <div className="relative flex flex-col gap-4 bg-white px-10 py-4">
            <h3 className="font-inter text-[24px] font-semibold leading-6 tracking-[-0.015em] text-black">
              {card.title}
            </h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center text-black"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="border-t border-[#B4BA61] bg-white px-10 py-4">
            <h3 className="mb-2 font-inter text-[20px] font-medium leading-6 tracking-[-0.015em] text-black">
              Visão Geral
            </h3>
            <p className="font-inter text-[16px] font-normal leading-6 tracking-[-0.015em] text-[#4A4E26]">
              {card.description}
            </p>
          </div>

          <table className="w-full border-collapse">
            <tbody>
              <TableRow label="Tipo">
                {type}
              </TableRow>

              <TableRow label="Período">
                {years.length > 0
                  ? `Data início: ${years[0]}  Data fim: ${years[years.length - 1]}`
                  : "-"}
              </TableRow>

              <TableRow label={"Escala\ntemporal"}>
                -
              </TableRow>

              <TableRow label="ID">
                {currentYearData?.imageId ?? "-"}
              </TableRow>

              <TableRow label={"min\npalette\nband"}>
                {`0,  max: ${maxValue},`}
                {"\n"}
                {palette ? `[ ${palette} ]` : "-"}
                {"\n"}
                {`'${card.title}'`}
              </TableRow>

              {legend && legend.length > 0 && (
                <TableRow label="Legenda">
                  <div className="flex flex-col">
                    {legend.map((item, index) => (
                      <span key={index}>
                        {index}: {item.label}
                      </span>
                    ))}
                  </div>
                </TableRow>
              )}
            </tbody>
          </table>
        </div>

        {card.fileRef && (
          <div className="shrink-0 border-t border-[#B4BA61] px-10 py-4">
            <a
              target="_blank"
              rel="noopener noreferrer"
              className={clsx(
                "flex h-10 w-full items-center justify-center rounded-[6px]",
                "bg-[#989F43]",
                "font-open-sans text-[14px] font-normal leading-6 text-white",
                "transition-colors hover:bg-[#7F8636]"
              )}
            >
              Saiba mais
            </a>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}