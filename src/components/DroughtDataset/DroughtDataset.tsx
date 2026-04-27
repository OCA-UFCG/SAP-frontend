"use client";

import clsx from "clsx";
import Image from "next/image";
import { normalizeContentfulImage } from "@/utils/functions";

export interface IDroughtDataset {
  id: number;
  title: string;
  description: string;
  image?: string;
  fileRef?: string;
}

function InfoIcon() {
  return (
    <svg width="16" height="16" aria-hidden>
      <use href="/sprite.svg#info" />
    </svg>
  );
}

export function DroughtDataset({
  card,
  active = false,
  disabled = false,
  onToggle,
  onDetails,
}: {
  card: IDroughtDataset;
  active?: boolean;
  disabled?: boolean;
  onToggle?: () => void;
  onDetails?: () => void;
}) {
  return (
    <div className="flex flex-row items-start w-full bg-white border border-[#EFEFEF] shadow-sm rounded-lg overflow-hidden shrink-0">
      <div className="flex flex-col items-start w-full">
        {/* card header */}
        <div
          className="flex flex-row items-center pr-4 gap-2 w-full"
          style={{ height: 126 }}
        >
          <div
            className="relative shrink-0"
            style={{ width: "115.51px", height: 126 }}
          >
            {card.image ? (
              <Image
                src={normalizeContentfulImage(card.image)}
                alt={card.title}
                fill
                sizes="116px"
                className="object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-[#E4E5E2]" />
            )}
          </div>

          <div
            className="flex flex-col items-start py-2 gap-[6px] flex-1"
            style={{ height: 126 }}
          >
            <div className="flex items-center w-full" style={{ height: 24 }}>
              <span className="w-full font-inter font-semibold text-[16px] leading-[24px] tracking-[-0.015em] text-[#292829] line-clamp-1">
                {card.title}
              </span>
            </div>
            <div className="flex items-start w-full flex-1">
              <span className="w-full font-inter font-normal text-[14px] leading-[20px] text-[#7E797B] line-clamp-3 break-words">
                {card.description}
              </span>
            </div>
          </div>
        </div>

        {/* card footer */}
        <div
          className="flex flex-row items-center w-full p-4 gap-4 border-t border-[#EFEFEF]"
          style={{ height: 72 }}
        >
          {/* Toggle (apply/unapply layer) */}
          <div className="flex flex-row justify-center items-center p-2 gap-2 w-[60px] h-10">
            <button
              type="button"
              role="switch"
              aria-checked={active}
              aria-label={
                active
                  ? `Desativar camada ${card.title}`
                  : `Ativar camada ${card.title}`
              }
              onClick={onToggle}
              disabled={disabled}
              className={clsx(
                "relative w-11 h-6 rounded-full transition-colors",
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
          </div>

          {/* Detalhamento (open analysis context) */}
          <button
            type="button"
            onClick={onDetails}
            disabled={disabled}
            className={clsx(
              "flex flex-row justify-center items-center px-4 py-2 gap-[10px] flex-1 h-10 bg-[#989F43] rounded-[6px]",
              disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
            )}
          >
            <span className="font-open-sans text-[14px] leading-[24px] font-normal text-white">
              Detalhamento
            </span>
          </button>

          <button
            type="button"
            className={clsx(
              "box-border flex flex-row justify-center items-center p-2 gap-2 w-10 h-10 bg-white border border-[#E4E5E2] rounded-[6px] shrink-0",
              disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
            )}
            aria-label="Mais informações"
            disabled={disabled}
          >
            <InfoIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
