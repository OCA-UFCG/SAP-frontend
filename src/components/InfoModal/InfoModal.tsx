"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import type { ImageDataConfig } from "@/utils/interfaces";
import {
  getImageDataLegend,
  getImageDataYearKeys,
} from "@/utils/imageData";
import { slugifyTranslationKey } from "@/utils/translations";
import { useDialogFocus } from "@/hooks/useDialogFocus";
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

function ExternalLinkIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 2.75h4.25V7" />
      <path d="M13.25 2.75 7.5 8.5" />
      <path d="M12 9.5v3.25a.5.5 0 0 1-.5.5H3.25a.5.5 0 0 1-.5-.5V4.5a.5.5 0 0 1 .5-.5H6.5" />
    </svg>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-3 font-open-sans text-base font-semibold leading-6 text-[#292829]">
      <span aria-hidden className="h-5 w-1 shrink-0 bg-[#646B2D]" />
      {children}
    </h3>
  );
}

function DetailItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-[8px] border border-[#E4E5E2] bg-[#F6F7F6] px-4 py-3">
      <dt className="font-open-sans text-xs font-semibold leading-[18px] text-[#676264]">
        {label}
      </dt>
      <dd className="font-open-sans text-base leading-6 text-[#292829]">
        {children}
      </dd>
    </div>
  );
}

export function InfoModal({
  card,
  imageData,
  open,
  onClose,
}: IInfoModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const learnMoreHintId = useId();
  const t = useTranslations("InfoModal");
  const tModules = useTranslations("ModulesContext.Layers");
  const tCaption = useTranslations("PlatformMapCaption");

  const slug = slugifyTranslationKey(card.title);

  const displayTitle = tModules.has(`${slug}.title`) ? tModules(`${slug}.title`, { title: card.title }) : card.title;
  const displayDescription = tModules.has(`${slug}.description`) ? tModules(`${slug}.description`, { description: card.description }) : card.description;

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Esc fecha, o Tab fica preso no diálogo e o foco volta a quem o abriu.
  useDialogFocus(panelRef, { open, onClose });

  if (typeof document === "undefined" || !open) {
    return null;
  }

  const years = getImageDataYearKeys(imageData);
  // O catálogo só grava http(s), mas o campo também pode ser editado direto no
  // Contentful, e um `javascript:` no href rodaria na plataforma.
  const learnMoreUrl =
    /^https?:\/\//iu.test(card.learnMoreUrl ?? "") &&
    URL.canParse(card.learnMoreUrl ?? "")
      ? card.learnMoreUrl
      : undefined;
  const legend = getImageDataLegend(imageData);

  // Quem clica precisa saber para onde vai antes de sair da plataforma.
  const learnMoreHost = learnMoreUrl
    ? new URL(learnMoreUrl).hostname.replace(/^www\./u, "")
    : "";

  return createPortal(
    // O fundo só fecha pelo mouse; pelo teclado quem fecha é o Esc.
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/35 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("ariaLabel", { title: displayTitle })}
        tabIndex={-1}
        className="flex max-h-[calc(100vh-32px)] w-[720px] max-w-full flex-col overflow-hidden rounded-[12px] bg-white shadow-[0_8px_40px_rgba(0,0,0,0.15)] focus:outline-none"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#E4E5E2] px-6 py-4">
          <h2 className="flex items-center gap-3 font-open-sans text-xl font-semibold leading-7 text-[#292829]">
            <span aria-hidden className="h-6 w-1 shrink-0 self-start mt-0.5 bg-[#646B2D]" />
            {displayTitle}
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] text-[#292829] transition-colors hover:bg-[#F5F6EE] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#646B2D]"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
          <section className="flex flex-col gap-2">
            <SectionTitle>{t("overview")}</SectionTitle>
            <p className="font-open-sans text-[0.9375rem] leading-6 text-[#50554C]">
              {displayDescription}
            </p>
          </section>

          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DetailItem label={t("period")}>
              {years.length > 0
                ? t("periodRange", {
                    start: years[0],
                    end: years[years.length - 1],
                  })
                : "-"}
            </DetailItem>

            <DetailItem label={t("timeScale")}>
              {card.timeScale ?? "-"}
            </DetailItem>
          </dl>

          {legend && legend.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionTitle>{t("legend")}</SectionTitle>
              {/* Em colunas, e não em linhas: a escala segue em ordem de cima para baixo. */}
              <ul className="gap-x-6 sm:columns-2">
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
                    <li
                      key={index}
                      className="mb-2 flex break-inside-avoid items-center gap-3 font-open-sans text-sm leading-5 text-[#292829] last:mb-0"
                    >
                      <span
                        aria-hidden
                        className="h-4 w-4 shrink-0 rounded-[4px] border border-black/10"
                        style={{ backgroundColor: item.color }}
                      />
                      {displayLabel}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        {learnMoreUrl && (
          <div className="flex shrink-0 flex-col gap-2 border-t border-[#E4E5E2] px-6 py-4">
            {/* Página de fora da plataforma: abre em outra aba para quem lê
                não perder o mapa que estava montado. */}
            <a
              href={learnMoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-describedby={learnMoreHintId}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-[#646B2D] px-4 font-open-sans text-base font-semibold leading-6 text-white transition-colors hover:bg-[#4F5424] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#646B2D] focus-visible:ring-offset-2"
            >
              {t("learnMore")}
              <ExternalLinkIcon />
            </a>
            <p
              id={learnMoreHintId}
              className="text-center font-open-sans text-xs leading-[18px] text-[#676264]"
            >
              {t("learnMoreHint", { host: learnMoreHost })}
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
