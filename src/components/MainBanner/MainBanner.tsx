"use client";

import { useState } from "react";
import { IMainBanner } from "@/utils/interfaces";
import Image from "next/image";
import { Link } from "@/translations/routing";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  CarouselArrow,
  CarouselTracker,
} from "@/components/HomeCarousel/HomeCarousel";

interface MainBannerProps {
  /** Um slide por entrada `banner` do Contentful. */
  banners: IMainBanner[];
}

export function MainBanner({ banners }: MainBannerProps) {
  const t = useTranslations("MainBanner");
  const [active, setActive] = useState(0);

  if (!banners.length) return null;
  const hasSlides = banners.length > 1;
  const goTo = (index: number) =>
    setActive((index + banners.length) % banners.length);

  return (
    <section className="relative w-full min-h-[512px] overflow-hidden bg-black">
      {banners.map((data, index) => (
        <div
          key={`${index}-${data.image.url}`}
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
                "linear-gradient(270deg, rgba(0, 0, 0, 0.05) 1.66%, #000000 113.85%)",
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

      {/* O padding de baixo deixa espaço para o card de números, que sobe
          80 px por cima do banner (BigNumbersSection). */}
      <div className="relative z-20 mx-auto flex min-h-[512px] w-full max-w-[1440px] flex-col justify-end gap-6 px-4 pt-12 pb-[120px] md:px-10 md:pt-20 lg:px-20">
        <div className="grid">
          {banners.map((data, index) => (
            <div
              key={`${index}-${data.image.url}`}
              aria-hidden={index !== active}
              inert={index !== active}
              className={cn(
                "col-start-1 row-start-1 flex flex-col justify-end gap-8 transition-opacity duration-500",
                index === active ? "opacity-100" : "opacity-0",
              )}
            >
              <div className="flex flex-col gap-4">
                <h1 className="max-w-[784px] font-open-sans text-[36px] font-bold leading-[1.2] text-[#F8F7F8] md:text-5xl">
                  {t("title", { title: data.title })}
                </h1>
                <p className="max-w-[784px] font-open-sans text-sm leading-6 text-white">
                  {t("subtitle", { subtitle: data.subtitle })}
                </p>
              </div>

              {/* No celular o menu do topo fica recolhido e não dispara o
                  prefetch completo da plataforma; este botão dispara. O
                  destino vem do campo "link" do banner. */}
              <Link
                href={data.link?.trim() || "/platform"}
                prefetch
                className="flex h-10 w-full items-center justify-center rounded-md bg-[#989F43] px-4 py-2 font-inter text-sm font-medium leading-6 text-[#F8F7F8] transition-colors hover:bg-[#5B612A] md:w-[302px]"
              >
                {t("linkText", { linkText: data.linkText })}
              </Link>
            </div>
          ))}
        </div>

        {/* Setas e traços só fazem sentido com mais de um banner publicado. */}
        {hasSlides && (
          <div className="flex items-center justify-between gap-6">
            <div className="-ml-2">
              <CarouselTracker
                count={banners.length}
                active={active}
                variant="dark"
                onSelect={goTo}
                label={(index) => t("goToSlide", { slide: index + 1 })}
              />
            </div>
            <div className="flex gap-2">
              <CarouselArrow
                direction="back"
                label={t("previous")}
                onClick={() => goTo(active - 1)}
                className="h-9 w-9 border-[#EFEFEF] bg-[#191B18] text-[#F8F7F8] hover:bg-[#3F4324]"
              />
              <CarouselArrow
                direction="forward"
                label={t("next")}
                onClick={() => goTo(active + 1)}
                className="h-9 w-9 border-[#EFEFEF] bg-[#191B18] text-[#F8F7F8] hover:bg-[#3F4324]"
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
