"use client";

import { useState, ReactNode } from "react";
import Image from "next/image";
import {
  documentToReactComponents,
  Options,
} from "@contentful/rich-text-react-renderer";
import { BLOCKS } from "@contentful/rich-text-types";
import { TabsSectionI } from "@/utils/interfaces";

interface TabsSectionProps {
  contentData: TabsSectionI[];
}

const DEFAULT_IMAGE_STYLE = {
  x: "50%",
  y: "15%",
  scale: 1,
};

const IMAGE_STYLE_BY_IDENTIFIER: Record<
  string,
  { x: string; y: string; scale: number }
> = {
  "sociedade-e-comunidades": { x: "50%", y: "15%", scale: 1 },
  "tecnicos-e-pesquisadores": { x: "50%", y: "5%", scale: 1 },
  "gestao-publica": { x: "0%", y: "50%", scale: 1 },
};

const TabsSection = ({ contentData }: TabsSectionProps) => {
  const [activeTabIdentifier, setActiveTabIdentifier] = useState(
    contentData[0]?.identifier ?? "",
  );

  if (!contentData || contentData.length === 0) return null;

  const currentTab =
    contentData.find((tab) => tab.identifier === activeTabIdentifier) ??
    contentData[0];
  const currentImageStyle =
    IMAGE_STYLE_BY_IDENTIFIER[currentTab.identifier] ?? DEFAULT_IMAGE_STYLE;

  const richTextOptions: Options = {
    renderNode: {
      [BLOCKS.PARAGRAPH]: (node, children: ReactNode) => <p>{children}</p>,
      [BLOCKS.UL_LIST]: (node, children: ReactNode) => (
        <ul className="list-disc pl-5 space-y-[8px]">{children}</ul>
      ),
      [BLOCKS.LIST_ITEM]: (node, children: ReactNode) => <li>{children}</li>,
    },
  };

  return (
    <section className="w-full bg-[#F6F7F6] flex flex-col items-center">
      <div className="w-full max-w-[1440px] mx-auto px-6 pt-8 md:px-10 md:pt-12 lg:px-[78px] lg:pt-[85px] flex flex-col items-start">
        <h2 className="text-[24px] md:text-[28px] lg:text-[30px] leading-[28px] md:leading-[32px] lg:leading-[36px] tracking-[-0.0075em] text-[#292829] font-semibold mb-6">
          Para quem é o SAP?
        </h2>

        <div className="flex flex-row gap-[24px] overflow-x-auto w-full no-scrollbar">
          {contentData.map((tab) => (
            <button
              key={tab.identifier}
              onClick={() => setActiveTabIdentifier(tab.identifier)}
              className={`px-4 md:px-8 py-3 rounded-t-[8px] font-open-sans font-medium text-[13px] md:text-[14px] whitespace-nowrap transition-colors border-b-0 ${
                activeTabIdentifier === tab.identifier
                  ? "bg-[#989F43] text-white"
                  : "bg-[#E4E5E2] text-[#3F4324] hover:bg-[#C8CAC5]"
              }`}
            >
              {tab.title}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full min-h-[550px] relative border-[4px] border-[#989F43] rounded-[8px] bg-black overflow-hidden flex flex-col md:justify-center">
        <div className="relative w-full h-[250px] z-0 flex items-center justify-center md:absolute md:top-0 md:left-0 md:w-[80%] md:h-full lg:w-[40%]">
          {currentTab.image?.url && (
            <Image
              src={currentTab.image.url}
              alt={currentTab.image.title || currentTab.title}
              fill
              className="object-cover"
              style={{
                objectPosition: `${currentImageStyle.x} ${currentImageStyle.y}`,
                transform: `scale(${currentImageStyle.scale})`,
              }}
              priority={currentTab.identifier === contentData[0].identifier}
            />
          )}
        </div>

        <div
          className="absolute inset-0 z-10 md:hidden"
          style={{
            background:
              "linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0) 100px, #000000 250px, #000000 100%)",
          }}
        />

        <div
          className="absolute inset-0 z-10 hidden md:block"
          style={{
            background:
              "linear-gradient(90deg, rgba(0, 0, 0, 0) 18.96%, #000000 41.39%)",
          }}
        />

        <div className="relative z-20 w-full max-w-[1440px] mx-auto px-6 md:px-10 lg:px-[78px] py-[32px] md:py-[48px] flex flex-col items-center text-center md:flex-row md:justify-end md:items-center md:text-left">
          <div className="w-full max-w-[90%] md:w-[60%] md:max-w-[795px] flex flex-col gap-[16px] md:gap-[24px]">
            <h3 className="text-[#989F43] font-open-sans font-semibold text-[20px] md:text-[24px] leading-[32px] tracking-[-0.006em]">
              {currentTab.title}
            </h3>

            <div className="flex flex-col gap-[16px] md:gap-[24px] text-[#F8F7F8] font-open-sans font-normal text-[14px] md:text-[16px] leading-[1.5]">
              {documentToReactComponents(
                currentTab.text?.json,
                richTextOptions,
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TabsSection;
