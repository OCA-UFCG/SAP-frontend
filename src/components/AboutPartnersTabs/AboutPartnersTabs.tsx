"use client";

import { useEffect, useMemo, useState } from "react";
import { documentToReactComponents } from "@contentful/rich-text-react-renderer";
import type { Document } from "@contentful/rich-text-types";

import { cn } from "@/lib/utils";
import type { PartnerI, SectionHeaderI } from "@/utils/interfaces";
import { PartnersSection } from "@/components/PartnersSection/PartnersSection";

type TabId = "about" | "partners";

interface AboutContentSection {
  title: string;
  text: string | Document;
  imageUrl: string;
  imageAlt?: string;
}

interface HeroContent {
  title: string;
  description: string | Document;
  imageUrl?: string;
}

type Props = {
  hero?: HeroContent;
  aboutSections?: AboutContentSection[];
  partnersHeader: SectionHeaderI;
  partners: PartnerI[];
  defaultTab?: TabId;
  className?: string;
};

export const AboutPartnersTabs = ({
  hero,
  aboutSections = [],
  partnersHeader,
  partners,
  defaultTab = "about",
  className = "",
}: Props) => {
  const tabs = useMemo(
    () =>
      [
        { id: "about" as const, label: "Sobre seca e desertificação" },
        { id: "partners" as const, label: "Parceiros" },
      ] satisfies Array<{ id: TabId; label: string }>,
    [],
  );

  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);
  const [isDesktop, setIsDesktop] = useState(false);
  const heroTitle = hero?.title ?? "";
  const heroDescription = hero?.description ?? "";
  const heroImageUrl = hero?.imageUrl;
  const heroSideGradient = isDesktop
    ? "linear-gradient(93.7deg, #000000 29.73%, rgba(152, 159, 67, 0) 117.14%)"
    : "linear-gradient(93.7deg, rgba(0, 0, 0, 0.9) 29.73%, rgba(152, 159, 67, 0) 117.14%)";

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const handleMediaChange = () => {
      setIsDesktop(mediaQuery.matches);
    };

    handleMediaChange();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleMediaChange);
      return () => {
        mediaQuery.removeEventListener("change", handleMediaChange);
      };
    }

    mediaQuery.addListener(handleMediaChange);
    return () => {
      mediaQuery.removeListener(handleMediaChange);
    };
  }, []);

  return (
    <section className={cn("w-full flex flex-col", className)}>
      <div
        className="w-full flex justify-center items-center px-6 sm:px-10 lg:px-[80px] py-16 lg:py-[96px]"
        style={{
          backgroundImage: `linear-gradient(96.47deg, rgba(0, 0, 0, 0) 45.64%, rgba(0, 0, 0, 0.56) 93.72%), ${heroSideGradient}${heroImageUrl ? `, url(${heroImageUrl})` : ""}`,
          backgroundSize: isDesktop
            ? "cover, cover, 65% auto"
            : "cover, cover, 150% auto",
          backgroundPosition: isDesktop
            ? "center, center, 100% 60%"
            : "center, center, 72% 40%",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="w-full max-w-[1280px] flex flex-col gap-[16px]">
          <h1 className="font-bold text-3xl md:text-[48px] md:leading-[68px] text-white">
            {heroTitle}
          </h1>
          <div className="text-base leading-[24px] text-white max-w-[891px]">
            {typeof heroDescription === "string"
              ? heroDescription
              : documentToReactComponents(heroDescription)}
          </div>
        </div>
      </div>

      <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-20 -mt-[44px] relative z-10">
        <div className="flex gap-6">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-pressed={isActive}
                className={cn(
                  "h-[44px] px-4 md:px-8 rounded-t-[8px] flex items-center justify-center transition-colors cursor-pointer",
                  tab.id === "about" && "pt-1 mb-[2px] md:mb-0",
                  isActive
                    ? "bg-[#989F43] text-[#F8F7F8] text-[15px] md:text-[18px] leading-[20px] md:leading-[28px] font-semibold"
                    : "bg-[#E4E5E2] text-[#292829] text-[16px] md:text-[20px] leading-[20px] md:leading-[28px] font-normal tracking-[-0.005em]",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "about" ? (
        <div className="w-full flex flex-col">
          {aboutSections.map((section, index) => {
            const imageFirst = index % 2 === 0;
            const hasBorderTop = index === 0;

            return (
              <section
                key={section.title}
                className="w-full bg-[#F8F7ED] relative isolate"
              >
                <div
                  className={cn(
                    "absolute inset-x-0 top-0 bg-[#E1E2B4] z-0",
                    hasBorderTop
                      ? "h-[236px] border-t-[5px] border-[#989F43]"
                      : "h-[240px]",
                  )}
                />

                <div className="relative z-[1] w-full max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-[80px] py-[48px]">
                  <div
                    className={cn(
                      "flex flex-col items-center gap-10 lg:gap-[44px]",
                      imageFirst ? "lg:flex-row" : "lg:flex-row-reverse",
                    )}
                  >
                    <div className="w-full lg:w-auto shrink-0">
                      <img
                        src={section.imageUrl}
                        alt={section.imageAlt ?? section.title}
                        width={594}
                        height={470}
                        className="w-full max-w-[594px] lg:h-[470px] h-auto rounded-[8px] object-cover"
                      />
                    </div>

                    <div className="w-full flex flex-col justify-center items-end gap-[64px] lg:w-[628px] lg:h-[470px] lg:pt-[18px]">
                      <div className="flex items-center w-full lg:w-[628px] lg:h-[95px]">
                        <h3 className="w-full lg:w-[624px] text-[36px] md:text-[48px] lg:text-[64px] leading-[49px] font-light text-[#3F4324]">
                          {section.title}
                        </h3>
                      </div>
                      <div className="flex items-center w-full lg:w-[628px] lg:h-[246px]">
                        <div className="w-full lg:w-[624px] lg:h-[216px] text-[16px] leading-[24px] font-normal text-[#3F4324]">
                          {typeof section.text === "string"
                            ? section.text
                            : documentToReactComponents(section.text)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <PartnersSection
          header={partnersHeader}
          partners={partners}
          className="border-t-[5px] border-[#989F43]"
        />
      )}
    </section>
  );
};
