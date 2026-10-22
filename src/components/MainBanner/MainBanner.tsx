"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { IMainBanner } from "@/utils/interfaces";
import Image from "next/image";
import { Link } from "@/translations/routing";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { contentfulImageLoader } from "@/utils/contentfulImageLoader";
import { revealOrder } from "@/components/HomeMotion/revealOrder";
import { BlurPreview } from "@/components/BlurPreview/BlurPreview";
import {
  CarouselArrow,
  CarouselTracker,
} from "@/components/HomeCarousel/HomeCarousel";
import {
  ArrowForwardIcon,
  PauseIcon,
  PlayIcon,
} from "@/components/HomeIcons/HomeIcons";

/** Tempo de cada slide antes de passar sozinho para o próximo. */
const AUTOPLAY_MS = 7000;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const subscribeReducedMotion = (onChange: () => void) => {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

interface MainBannerProps {
  /** Um slide por entrada `banner` do Contentful. */
  banners: IMainBanner[];
  /** Prévia borrada de cada slide, na ordem dos banners (`getBlurPreviews`). */
  previews?: Array<string | undefined>;
}

export function MainBanner({ banners, previews = [] }: MainBannerProps) {
  const t = useTranslations("MainBanner");
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  // Fotos que já chegaram: as seguintes só aparecem inteiras, em fade.
  const [loaded, setLoaded] = useState<ReadonlySet<number>>(() => new Set());
  // Parado pelo botão de pausar: só volta a passar quando a pessoa aperta de
  // novo. Até ela apertar, quem pediu menos movimento no sistema vê parado.
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
  const [userStopped, setUserStopped] = useState<boolean | null>(null);
  const stopped = userStopped ?? reducedMotion;
  const hasSlides = banners.length > 1;

  // Passa sozinho; para enquanto o mouse ou o foco do teclado estão no banner.
  // Como depende de `active`, clicar numa seta ou num traço recomeça a
  // contagem.
  useEffect(() => {
    if (!hasSlides || paused || stopped) return;
    const timer = window.setTimeout(
      () => setActive((current) => (current + 1) % banners.length),
      AUTOPLAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [active, paused, stopped, hasSlides, banners.length]);

  if (!banners.length) return null;
  const goTo = (index: number) =>
    setActive((index + banners.length) % banners.length);
  // Só a foto da vez baixa de início; a seguinte começa quando ela chega. Antes
  // as cinco baixavam juntas e disputavam a rede com o resto da home no
  // celular: fotos dos módulos e logos dos parceiros esperavam o banner.
  const next = (active + 1) % banners.length;
  const shouldMount = (index: number) =>
    index === active ||
    loaded.has(index) ||
    (index === next && loaded.has(active));

  return (
    <section
      className="relative w-full min-h-[512px] overflow-hidden bg-black"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      {banners.map((data, index) => (
        <div
          key={`${index}-${data.image.url}`}
          aria-hidden={index !== active}
          className={cn(
            "absolute inset-0 z-0 transition-opacity duration-500",
            index === active ? "opacity-100" : "opacity-0",
          )}
        >
          {/* No celular lento, a prévia aparece com a página, e não o preto. */}
          <BlurPreview src={previews[index]} />
          {shouldMount(index) && (
            <Image
              src={data.image.url}
              loader={contentfulImageLoader}
              sizes="100vw"
              alt={t("imageAlt", { imageAlt: data.title || "" })}
              fill
              preload={index === 0}
              onLoad={() =>
                setLoaded((current) => new Set(current).add(index))
              }
              // A primeira não espera o JavaScript para aparecer: no celular
              // ele pode levar segundos, e ela já chega leve.
              className={cn(
                "object-cover object-center transition-opacity duration-[600ms] ease-out",
                index !== 0 && !loaded.has(index) && "opacity-0",
              )}
            />
          )}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(270deg, rgba(0, 0, 0, 0.05) 1.66%, #000000 113.85%)",
            }}
          />
        </div>
      ))}

      {/* O padding de baixo deixa espaço para o card de números, que sobe
          80 px por cima do banner (BigNumbersSection). */}
      <div
        data-shown
        className="relative z-20 mx-auto flex min-h-[512px] w-full max-w-[1440px] flex-col justify-end gap-6 px-4 pt-12 pb-[120px] md:px-10 md:pt-20 lg:px-20"
      >
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
              {/* Ao trocar de slide, título, texto e botão entram em cascata. */}
              <div className="flex flex-col gap-4">
                <h1
                  className={cn(
                    "max-w-[784px] font-open-sans text-[2.25rem] font-bold leading-[1.2] text-[#F8F7F8] md:text-5xl",
                    index === active && "reveal-item",
                  )}
                >
                  {t("title", { title: data.title })}
                </h1>
                <p
                  className={cn(
                    "max-w-[784px] font-open-sans text-sm leading-6 text-white xl:max-w-[960px] xl:text-base",
                    index === active && "reveal-item",
                  )}
                  style={revealOrder(1)}
                >
                  {t("subtitle", { subtitle: data.subtitle })}
                </p>
              </div>

              {/* No celular o menu do topo fica recolhido e não dispara o
                  prefetch completo da plataforma; este botão dispara. O
                  destino vem do campo "link" do banner. */}
              <Link
                href={data.link?.trim() || "/platform"}
                prefetch
                style={revealOrder(2)}
                className={cn(
                  "shine group/cta flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#646B2D] px-4 py-2 font-inter text-sm font-medium leading-6 text-[#F8F7F8] transition-colors hover:bg-[#4F5424] md:w-[302px]",
                  index === active && "reveal-item",
                )}
              >
                {t("linkText", { linkText: data.linkText })}
                <ArrowForwardIcon
                  size={16}
                  className="transition-transform motion-safe:group-hover/cta:translate-x-1"
                />
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
              <button
                type="button"
                aria-label={stopped ? t("resume") : t("pause")}
                onClick={() => setUserStopped(!stopped)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#EFEFEF] bg-[#191B18] text-[#F8F7F8] transition-opacity hover:bg-[#3F4324]"
              >
                {stopped ? <PlayIcon size={16} /> : <PauseIcon size={16} />}
              </button>
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
