"use client";

import clsx from "clsx";
import Image from "next/image";
import { normalizeContentfulImage } from "@/utils/functions";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { InfoModal } from "../InfoModal/InfoModal";
import type { ImageDataConfig } from "@/utils/interfaces";
import { slugifyTranslationKey } from "@/utils/translations";

export interface IDroughtDataset {
  id: number;
  title: string;
  description: string;
  image?: string;
  fileRef?: string;
  imageData?: ImageDataConfig | null;
  timeScale?: string;
}

function InfoIcon() {
  return (
    <svg width="16" height="16" aria-hidden className="text-[#2C1E1C]">
      <use href="/sprite.svg#info" />
    </svg>
  );
}

export function DroughtDataset({
  card,
  imageData,
  active = false,
  disabled = false,
  onToggle,
  onDetails,
}: {
  card: IDroughtDataset;
  imageData?: ImageDataConfig | null;
  active?: boolean;
  disabled?: boolean;
  onToggle?: () => void;
  onDetails?: () => void;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const t = useTranslations("DroughtDataset");
  const tModules = useTranslations("ModulesContext.Layers");

  const slug = slugifyTranslationKey(card.title);

  const displayTitle = tModules.has(`${slug}.title`) ? tModules(`${slug}.title`, { title: card.title }) : card.title;

  return (
    <>
      <div
        data-tour="layer-card"
        className="flex flex-row items-center gap-3 w-full p-3 bg-white border border-[#EFEFEF] shadow-sm rounded-lg shrink-0"
      >
        {/* 80px, e não 96: no Windows a barra de rolagem do painel come 17px e,
            com a imagem maior, o "Detalhamento" saía cortado. */}
        <div className="relative shrink-0 size-20 overflow-hidden rounded-md">
          {card.image ? (
            <Image
              src={normalizeContentfulImage(card.image)}
              alt={displayTitle}
              fill
              sizes="80px"
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-[#E4E5E2]" />
          )}
        </div>

        {/* Título inteiro e, embaixo, os botões; a descrição fica no "i" */}
        <div className="flex flex-col gap-3 flex-1 min-w-0">
          <span className="font-inter font-semibold text-[16px] leading-[22px] tracking-[-0.015em] text-[#292829] break-words">
            {displayTitle}
          </span>

          <div className="flex flex-row items-center gap-1.5">
            {/* Toggle (apply/unapply layer) */}
            <button
              type="button"
              role="switch"
              aria-checked={active}
              aria-label={
                active
                  ? t("deactivateLayer", { title: displayTitle })
                  : t("activateLayer", { title: displayTitle })
              }
              onClick={onToggle}
              disabled={disabled}
              className={clsx(
                "relative w-11 h-6 shrink-0 rounded-full transition-colors",
                active ? "bg-[#989F43]" : "bg-[#E4E5E2]",
                disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#989F43] focus-visible:ring-offset-2",
              )}
            >
              <span
                className={clsx(
                  "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-200",
                  active ? "translate-x-5" : "translate-x-0",
                )}
              />
            </button>

            {/* Detalhamento (open analysis context) */}
            <button
              type="button"
              onClick={onDetails}
              disabled={disabled}
              className={clsx(
                "flex flex-row justify-center items-center px-2 h-10 min-w-0 flex-1 bg-[#989F43] rounded-[6px]",
                disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
              )}
            >
              <span className="font-open-sans text-[14px] leading-[24px] font-normal text-white truncate">
                {t("details")}
              </span>
            </button>

            {/* Botão de informações — abre o InfoModal */}
            <button
              type="button"
              onClick={() => setInfoOpen(true)}
              disabled={disabled}
              aria-label={t("moreInformation", { title: displayTitle })}
              className={clsx(
                "box-border flex flex-row justify-center items-center p-2 w-10 h-10 bg-white border border-[#E4E5E2] rounded-[6px] shrink-0",
                disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-[#F5F6EE] transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#989F43] focus-visible:ring-offset-2",
              )}
            >
              <InfoIcon />
            </button>
          </div>
        </div>
      </div>
      <InfoModal
        card={card}
        imageData={imageData}
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
      />
    </>
  );
}
