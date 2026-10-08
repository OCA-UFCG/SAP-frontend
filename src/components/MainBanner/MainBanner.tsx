"use client";

import { useState } from "react";
import { IMainBanner } from "@/utils/interfaces";
import Image from "next/image";
import { Link } from "@/translations/routing";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { ArrowBackIcon, ArrowForwardIcon } from "@/components/HomeIcons/HomeIcons";
import { CarouselTracker } from "@/components/HomeCarousel/HomeCarousel";

interface MainBannerProps {
  /** Um slide por entrada `banner` do Contentful. */
  banners: IMainBanner[];
}

export function MainBanner({ banners }: MainBannerProps) {
  const t = useTranslations("MainBanner");
  const [active, setActive] = useState(0);

  if (!banners.length) return null;
  // Setas e traços só fazem sentido com mais de um banner publicado.
  const hasSlides = banners.length > 1;
  const goTo = (index: number) =>
    setActive((index + banners.length) % banners.length);

  return (
    <section className="relative w-full min-h-[532px] overflow-hidden bg-[#4A4E26]">
      {banners.map((data, index) => (
        <div
          key={data.image.url}
          aria-hidden={index !== active}
          className={cn(
            "absolute inset-0 z-0 transition-opacity duration-500",
            index === active ? "opacity-100" : "opacity-0",
          )}
        >
          <Image
            src={data.image.url}
            alt={t("imageAlt", { imageAlt: data.title || "" })}
            fill
            priority={index === 0}
            unoptimized
            className="object-cover object-center"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(270deg, rgba(0, 0, 0, 0.05) 19.23%, #4A4E26 65.38%)",
            }}
          />
        </div>
      ))}

      <div className="absolute opacity-[0.05] left-0 -translate-x-[38%] -translate-y-[32%] pointer-events-none">
        <Image
          src="/solar_icon.png"
          alt=""
          width={750}
          height={750}
          className="max-w-none w-[800px] lg:w-[1000px] h-auto scale-y-75 scale-x-90"
        />
      </div>

      <div className="relative z-20 mx-auto flex min-h-[532px] w-full max-w-[1440px] items-center gap-6 px-4 py-12 md:px-10 md:py-16">
        <HeroArrow
          direction="back"
          label={t("previous")}
          hidden={!hasSlides}
          onClick={() => goTo(active - 1)}
        />

        <div className="grid flex-1 self-stretch">
          {banners.map((data, index) => (
            <div
              key={data.image.url}
              aria-hidden={index !== active}
              inert={index !== active}
              className={cn(
                "col-start-1 row-start-1 flex flex-col justify-end gap-8 transition-opacity duration-500",
                index === active ? "opacity-100" : "opacity-0",
              )}
            >
              <div className="flex flex-col gap-4">
                <h1 className="max-w-[579px] font-open-sans text-[40px] font-bold leading-[44px] text-[#F8F7F8] md:text-[64px] md:leading-[68px]">
                  {t("title", { title: data.title })}
                </h1>
                <p className="max-w-[578px] font-open-sans text-base leading-6 text-white">
                  {t("subtitle", { subtitle: data.subtitle })}
                </p>
              </div>

              {/* No celular o menu do topo fica recolhido e não dispara o
                  prefetch completo da plataforma; este botão dispara. */}
              <Link
                href="/platform"
                prefetch
                className="flex h-10 w-full items-center justify-center rounded-md bg-[#989F43] px-4 py-2 font-inter text-sm font-medium leading-6 text-[#F8F7F8] transition-colors hover:bg-[#5B612A] md:w-[302px]"
              >
                {t("linkText", { linkText: data.linkText })}
              </Link>
            </div>
          ))}

          {hasSlides && (
            <div className="-ml-2 mt-6">
              <CarouselTracker
                count={banners.length}
                active={active}
                variant="dark"
                onSelect={goTo}
                label={(index) => t("goToSlide", { slide: index + 1 })}
              />
            </div>
          )}
        </div>

        <HeroArrow
          direction="forward"
          label={t("next")}
          hidden={!hasSlides}
          onClick={() => goTo(active + 1)}
        />
      </div>
    </section>
  );
}

// Com um banner só as setas ficam invisíveis, mas seguram o espaço para o
// texto continuar alinhado onde o design o coloca.
function HeroArrow({
  direction,
  label,
  hidden,
  onClick,
}: {
  direction: "back" | "forward";
  label: string;
  hidden: boolean;
  onClick: () => void;
}) {
  const Icon = direction === "back" ? ArrowBackIcon : ArrowForwardIcon;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "hidden h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[#EFEFEF] bg-[#21240F] text-[#F8F7F8] transition-colors hover:bg-[#3F4324] md:flex",
        hidden && "invisible",
      )}
    >
      <Icon size={16} />
    </button>
  );
}
