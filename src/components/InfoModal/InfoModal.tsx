"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { useTranslations } from "next-intl";
import type { ImageDataConfig } from "@/utils/interfaces";
import {
  getImageDataLegend,
  getImageDataYearKeys,
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
    <svg width="14" height="14" aria-hidden>
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
  const t = useTranslations("InfoModal");
  const tModules = useTranslations("ModulesContext.Layers");
  const tCaption = useTranslations("PlatformMapCaption");

  const slug = card.title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  const displayTitle = tModules.has(`${slug}.title`) ? tModules(`${slug}.title`, { title: card.title }) : card.title;
  const displayDescription = tModules.has(`${slug}.description`) ? tModules(`${slug}.description`, { description: card.description }) : card.description;

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

  if (typeof document === "undefined" || !open) {
    return null;
  }

  const years = getImageDataYearKeys(imageData);
  const legend = getImageDataLegend(imageData);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={t("ariaLabel", { title: displayTitle })}
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
        <div className="shrink-0 border-b border-[#B4BA61]/40">
          <div className="relative flex flex-col gap-4 bg-white px-10 py-4">
            <h3 className="font-inter text-[24px] font-semibold leading-6 tracking-[-0.015em] text-black">
              {displayTitle}
            </h3>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="absolute right-4 top-4 flex h-5 w-5 items-center justify-center text-[#4A4E26] transition-opacity hover:opacity-70"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="border-t border-[#B4BA61]/40 bg-white px-10 py-4">
            <h3 className="mb-2 font-inter text-[20px] font-medium leading-6 tracking-[-0.015em] text-black">
              {t("overview")}
            </h3>

            <p className="font-inter text-[16px] font-normal leading-6 tracking-[-0.015em] text-[#4A4E26]">
              {displayDescription}
            </p>
          </div>

          <table className="w-full border-collapse">
            <tbody>
              <TableRow label={t("period")}>
                {years.length > 0
                  ? `${t("startDate")} ${years[0]}  ${t("endDate")} ${
                      years[years.length - 1]
                    }`
                  : "-"}
              </TableRow>

              <TableRow label={t("timeScale")}>
                {card.timeScale ?? "-"}
              </TableRow>

              {legend && legend.length > 0 && (
                <TableRow label={t("legend")}>
                  <div className="flex flex-col">
                    {legend.map((item, index) => {
                      const labelSlug = item.label
                        .toLowerCase()
                        .normalize("NFD")
                        .replace(/[\u0300-\u036f]/g, "")
                        .replace(/</g, "menor-que")
                        .replace(/>/g, "maior-que")
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/(^-|-$)+/g, "");
                      const displayLabel = tCaption.has(`labels.${labelSlug}`)
                        ? tCaption(`labels.${labelSlug}`)
                        : item.label;
                      return (
                        <span key={index}>
                          {index}: {displayLabel}
                        </span>
                      );
                    })}
                  </div>
                </TableRow>
              )}
            </tbody>
          </table>
        </div>

        {card.fileRef && (
          <div className="shrink-0 border-t border-[#B4BA61]/40 px-10 py-4">
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
              {t("learnMore")}
            </a>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
