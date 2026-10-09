"use client";

import { Children, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { ArrowBackIcon, ArrowForwardIcon } from "@/components/HomeIcons/HomeIcons";

const GAP_PX = 24;

type Props = {
  children: ReactNode;
  /** `dark` troca a cor dos traços do indicador para o fundo escuro. */
  variant?: "light" | "dark";
  className?: string;
};

/**
 * Faixa de cards da home: três por vez no desktop, dois no tablet e um no
 * celular. Rola por página com as setas ou arrastando; o indicador de traços
 * mostra em que página a pessoa está. Setas e traços só aparecem quando há
 * mais de uma página.
 */
export const HomeCarousel = ({ children, variant = "light", className }: Props) => {
  const t = useTranslations("HomeCarousel");
  const trackRef = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState(1);
  const [page, setPage] = useState(0);

  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const pageWidth = track.clientWidth + GAP_PX;
    // A última página pode ter menos cards; a folga de 0,01 evita que um
    // arredondamento de subpixel crie uma página vazia.
    const count = Math.max(1, Math.ceil((track.scrollWidth + GAP_PX) / pageWidth - 0.01));
    const atEnd = track.scrollLeft >= track.scrollWidth - track.clientWidth - 1;
    setPageCount(count);
    setPage(atEnd ? count - 1 : Math.round(track.scrollLeft / pageWidth));
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    measure();
    track.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      track.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  const goTo = (target: number) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: target * (track.clientWidth + GAP_PX), behavior: "smooth" });
  };

  const hasPages = pageCount > 1;

  return (
    <div className={cn("flex w-full flex-col gap-6", className)}>
      <div
        ref={trackRef}
        className="flex w-full snap-x snap-mandatory gap-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {Children.map(children, (child) => (
          <div className="w-full shrink-0 snap-start md:w-[calc((100%-24px)/2)] lg:w-[calc((100%-48px)/3)]">
            {child}
          </div>
        ))}
      </div>

      {hasPages && (
        <div className="flex items-center justify-between gap-6">
          <CarouselTracker
            count={pageCount}
            active={page}
            variant={variant}
            onSelect={goTo}
            label={(index) => t("goToPage", { page: index + 1 })}
          />
          <div className="flex gap-2">
            <CarouselArrow
              direction="back"
              label={t("previous")}
              disabled={page === 0}
              onClick={() => goTo(page - 1)}
            />
            <CarouselArrow
              direction="forward"
              label={t("next")}
              disabled={page >= pageCount - 1}
              onClick={() => goTo(page + 1)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

type TrackerProps = {
  count: number;
  active: number;
  variant: "light" | "dark";
  onSelect: (index: number) => void;
  label: (index: number) => string;
};

/** Traços do indicador: o da página atual é mais comprido e verde-claro. */
export const CarouselTracker = ({ count, active, variant, onSelect, label }: TrackerProps) => (
  <div className="flex items-center gap-4 p-2">
    {Array.from({ length: count }, (_, index) => (
      <button
        key={index}
        type="button"
        aria-label={label(index)}
        aria-current={index === active}
        onClick={() => onSelect(index)}
        className="flex h-4 items-center"
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
        "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[#EFEFEF] bg-white text-[#989F43] transition-opacity hover:bg-[#F6F7F6] disabled:cursor-default disabled:opacity-50 disabled:hover:bg-white",
        className,
      )}
    >
      <Icon size={16} />
    </button>
  );
};

export default HomeCarousel;
