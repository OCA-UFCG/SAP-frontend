"use client";

import { useState } from "react";

const TABS_DATA = [
  {
    buttonLabel: "Sociedade e comunidades",
    title: "Sociedade e comunidades",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer gravida mi ut vestibulum vestibulum. Donec a fermentum est. Aliquam efficitur et purus at facilisis.",
    backgroundImage: "/tabs-bg-1.jpg",
    listItems: [
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
      "Integer gravida mi ut vestibulum vestibulum. Donec a fermentum est. Aliquam efficitur et purus at facilisis.",
      "Cras ultricies metus lacus. Duis dictum finibus turpis, quis euismod lorem vehicula quis."
    ]
  },
  {
    buttonLabel: "Técnicos e pesquisadores",
    title: "Técnicos e pesquisadores",
    description: "Conteúdo focado em pesquisadores e no desenvolvimento técnico da ferramenta SAP para análise de dados precisos.",
    backgroundImage: "/tabs-bg-2.jpg",
    listItems: [
      "Acesso a dados integrados",
      "Monitoramento em tempo real",
      "Relatórios customizáveis"
    ]
  },
  {
    buttonLabel: "Gestão pública",
    title: "Gestão pública",
    description: "Soluções voltadas para a transparência e agilidade nos processos de tomada de decisão no setor público.",
    backgroundImage: "/tabs-bg-3.jpg",
    listItems: [
      "Otimização de processos",
      "Transparência pública",
      "Tomada de decisão baseada em dados"
    ]
  }
];

const TabsSection = () => {
  const [activeTab, setActiveTab] = useState(0);
  const currentTab = TABS_DATA[activeTab];

  return (
    <section className="w-full flex flex-col items-center bg-[#F6F7F6]">
      <div className="w-full max-w-[1440px] px-6 md:px-20 py-12 flex flex-col gap-[24px]">
        <h2 className="text-[#3F4324] font-inter font-semibold text-[30px] leading-tight">
          Para quem é o SAP?
        </h2>

        <div className="flex flex-wrap gap-[10px]">
          {TABS_DATA.map((tab, index) => (
            <button
              key={index}
              onClick={() => setActiveTab(index)}
              className={`px-[32px] py-[12px] rounded-t-[8px] font-inter font-medium text-[14px] transition-colors ${
                activeTab === index
                  ? "bg-[#989F43] text-white"
                  : "bg-[#E4E5E2] text-[#3F4324] hover:bg-[#C8CAC5]"
              }`}
            >
              {tab.buttonLabel}
            </button>
          ))}
        </div>
      </div>

      <div 
        className="w-full max-w-[1440px] h-[470px] relative border-[4px] border-[#989F43] rounded-[8px] overflow-hidden flex justify-end"
        style={{
          backgroundImage: `url(${currentTab.backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div 
          className="absolute inset-y-0 right-0 w-3/4 z-0"
          style={{
            background: 'linear-gradient(270deg, #000000 0%, #000000 40%, rgba(0, 0, 0, 0) 100%)'
          }}
        />

        <div className="relative z-10 w-[795px] h-[360px] my-auto mr-[80px] flex flex-col gap-[24px] text-left">
          <h3 className="text-[#989F43] font-inter font-semibold text-[24px] leading-tight">
            {currentTab.title}
          </h3>
          
          <div className="flex flex-col gap-[16px] text-white font-inter font-medium text-[16px] leading-[1.5]">
            <p>{currentTab.description}</p>
            
            <ul className="list-disc pl-5 space-y-2">
              {currentTab.listItems.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="absolute -top-[10px] -right-[10px]">
            <div className="w-[32px] h-[32px] bg-[#E24E2E] rounded-full flex items-center justify-center text-white font-bold text-[12px]">S</div>
          </div>
          <div className="absolute -bottom-[10px] -right-[10px]">
            <div className="w-[32px] h-[32px] bg-[#E24E2E] rounded-full flex items-center justify-center text-white font-bold text-[12px]">S</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TabsSection;