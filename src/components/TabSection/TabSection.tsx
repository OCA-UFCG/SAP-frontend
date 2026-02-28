"use client";

import { useState, ReactNode } from "react";
import Image from "next/image";
import { documentToReactComponents, Options } from "@contentful/rich-text-react-renderer";
import { BLOCKS } from "@contentful/rich-text-types";
import { TabsSectionI } from "@/utils/interfaces";

const HARDCODED_TABS = [
  "Sociedade e comunidades",
  "Técnicos e pesquisadores",
  "Gestão pública"
];

interface TabsSectionProps {
  contentData: TabsSectionI[];
}

const TabsSection = ({ contentData }: TabsSectionProps) => {
  const [activeTab, setActiveTab] = useState(0);

  if (!contentData || contentData.length === 0) return null;

  const currentTab = contentData[activeTab];

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
          {HARDCODED_TABS.map((tabLabel, index) => (
            <button
              key={index}
              onClick={() => setActiveTab(index)}
              className={`px-4 md:px-8 py-3 rounded-t-[8px] font-['Open_Sans'] font-medium text-[13px] md:text-[14px] whitespace-nowrap transition-colors border-b-0 ${
                activeTab === index
                  ? "bg-[#989F43] text-white"
                  : "bg-[#E4E5E2] text-[#3F4324] hover:bg-[#C8CAC5]"
              }`}
            >
              {tabLabel}
            </button>
          ))}
        </div>
      </div>

      {/* MUDANÇA AQUI: Trocamos 'border-y-[4px]' por 'border-[4px]' e adicionamos 'rounded-[8px]' */}
      <div className="w-full min-h-[550px] relative border-[4px] border-[#989F43] rounded-[8px] bg-black overflow-hidden flex flex-col justify-center">
        
        <div className="absolute top-0 left-0 w-full md:w-[50%] lg:w-[45%] h-full z-0 flex items-center justify-center">
          {currentTab.image?.url && (
            <Image 
              src={currentTab.image.url}
              alt={currentTab.image.title || currentTab.title}
              fill
              className="object-cover object-center"
              priority={activeTab === 0}
            />
          )}
        </div>

        <div 
          className="absolute inset-0 z-10"
          style={{
            background: 'linear-gradient(90deg, rgba(0, 0, 0, 0) 18.96%, #000000 41.39%)',
          }}
        />

        <div className="relative z-20 w-full max-w-[1440px] mx-auto px-6 md:px-10 lg:px-[78px] py-[48px] flex flex-row justify-end items-center">
          
          <div className="w-[60%] max-w-[795px] flex flex-col gap-[24px] text-left">
            <h3 className="text-[#989F43] font-['Open_Sans'] font-semibold text-[20px] md:text-[24px] leading-[32px] tracking-[-0.006em]">
              {currentTab.title}
            </h3>
            
            <div className="flex flex-col gap-[24px] text-[#F8F7F8] font-['Open_Sans'] font-normal text-[14px] md:text-[16px] leading-[1.5]">
              {documentToReactComponents(currentTab.text?.json, richTextOptions)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TabsSection;