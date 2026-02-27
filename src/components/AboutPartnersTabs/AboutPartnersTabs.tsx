"use client";

import { useMemo, useState } from "react";
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

/* ── Mock data (será substituído por dados do Contentful) ── */

const MOCK_HERO: HeroContent = {
  title: "Sobre nós",
  description:
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
};

const MOCK_ABOUT_SECTIONS: AboutContentSection[] = [
  {
    title: "Sobre seca",
    text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
    imageUrl: "https://picsum.photos/seed/seca/594/470",
    imageAlt: "Imagem sobre seca",
  },
  {
    title: "Sobre Desertificação",
    text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
    imageUrl: "https://picsum.photos/seed/desert/594/470",
    imageAlt: "Imagem sobre desertificação",
  },
];

/* ── Component ── */

export const AboutPartnersTabs = ({
  hero = MOCK_HERO,
  aboutSections = MOCK_ABOUT_SECTIONS,
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

  return (
    <section className={cn("w-full flex flex-col", className)}>
      {/* ── Hero Banner ── */}
      <div
        className="w-full flex justify-center items-center px-6 sm:px-10 lg:px-[80px] py-16 lg:py-[96px]"
        style={{
          backgroundImage: `linear-gradient(96.47deg, rgba(0, 0, 0, 0) 45.64%, rgba(0, 0, 0, 0.56) 93.72%), linear-gradient(93.7deg, rgba(0, 0, 0, 0.9) 29.73%, rgba(152, 159, 67, 0) 117.14%)${hero.imageUrl ? `, url(${hero.imageUrl})` : ""}`,
          backgroundSize: "cover, cover, 65% auto",
          backgroundPosition: "center, center, 100% 60%",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="w-full max-w-[1280px] flex flex-col gap-[16px]">
          <h1 className="font-bold text-3xl md:text-[48px] md:leading-[68px] text-white">
            {hero.title}
          </h1>
          <div className="text-base leading-[24px] text-white max-w-[891px]">
            {typeof hero.description === "string"
              ? hero.description
              : documentToReactComponents(hero.description)}
          </div>
        </div>
      </div>

      {/* ── Tab Bar ── */}
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
                  "h-[44px] px-8 rounded-t-[8px] flex items-center justify-center transition-colors cursor-pointer",
                  tab.id === "about" && "pt-1",
                  isActive
                    ? "bg-[#989F43] text-[#F8F7F8] text-[18px] leading-[28px] font-semibold"
                    : "bg-[#E4E5E2] text-[#292829] text-[20px] leading-[28px] font-normal tracking-[-0.005em]",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab Content ── */}
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
                {/* Green accent strip */}
                <div
                  className={cn(
                    "absolute inset-x-0 top-0 bg-[#E1E2B4] z-0",
                    hasBorderTop
                      ? "h-[236px] border-t-[5px] border-[#989F43]"
                      : "h-[240px]",
                  )}
                />

                {/* Content */}
                <div className="relative z-[1] w-full max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-[80px] py-[48px]">
                  <div
                    className={cn(
                      "flex flex-col items-center gap-10 lg:gap-[44px]",
                      imageFirst ? "lg:flex-row" : "lg:flex-row-reverse",
                    )}
                  >
                    {/* Image */}
                    <div className="w-full lg:w-auto shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={section.imageUrl}
                        alt={section.imageAlt ?? section.title}
                        width={594}
                        height={470}
                        className="w-full max-w-[594px] lg:h-[470px] h-auto rounded-[8px] object-cover"
                      />
                    </div>

                    {/* Text */}
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
