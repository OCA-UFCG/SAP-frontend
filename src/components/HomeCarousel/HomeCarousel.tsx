"use client";

import { cn } from "@/lib/utils";
import { ArrowBackIcon, ArrowForwardIcon } from "@/components/HomeIcons/HomeIcons";

type TrackerProps = {
  count: number;
  active: number;
  variant: "light" | "dark";
  onSelect: (index: number) => void;
  label: (index: number) => string;
};

/**
 * Traços do indicador: o da página atual é mais comprido e verde-claro.
 *
 * O traço tem 6px de largura, mas o botão vai 8px para cada lado (`px-2`,
 * desfeito pelo `-mx-2`) e tem 40px de altura: a área de toque passa de 6x16
 * para 22x40 sem mudar o espaçamento entre os traços.
 */
export const CarouselTracker = ({ count, active, variant, onSelect, label }: TrackerProps) => (
  <div className="flex items-center gap-4 p-2">
    {Array.from({ length: count }, (_, index) => (
      <button
        key={index}
        type="button"
        aria-label={label(index)}
        aria-current={index === active}
        onClick={() => onSelect(index)}
        className="-mx-2 flex h-10 cursor-pointer items-center px-2"
      >
        <span
          className={cn(
            "block h-1 transition-all duration-300",
            index === active
              ? "w-5 bg-[#CCCF87]"
              : variant === "dark"
                ? "w-1.5 bg-[#F6F7F6]"
                : "w-1.5 bg-[#292829]",
          )}
        />
      </button>
    ))}
  </div>
);

type ArrowProps = {
  direction: "back" | "forward";
  label: string;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
};

export const CarouselArrow = ({ direction, label, disabled, onClick, className }: ArrowProps) => {
  const Icon = direction === "back" ? ArrowBackIcon : ArrowForwardIcon;
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[#EFEFEF] bg-white text-[#646B2D] transition-opacity hover:bg-[#F6F7F6] disabled:cursor-default disabled:opacity-50 disabled:hover:bg-white",
        className,
      )}
    >
      <Icon size={16} />
    </button>
  );
};
