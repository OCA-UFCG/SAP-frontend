"use client";

import { useState } from "react";
import { DroughtDataset, DROUGHT_DATASETS } from "../DroughtDataset/DroughtDataset";
import type { IDroughtDataset } from "../DroughtDataset/DroughtDataset";
import { PlatformSection } from "../PlatformSideRail/PlatformSideRail";
import { Chevron } from "../Chevron/Chevron";

interface AccordionItemData {
  id: number;
  label: string;
  datasets?: IDroughtDataset[];
}
export interface AccordionContextProps {
  activeSection: PlatformSection;
}

const MONITORING_ITEMS: AccordionItemData[] = [
  {
    id: 1,
    label: "Seca",
    datasets: DROUGHT_DATASETS,
  },
  {
    id: 2,
    label: "Desertificação",
  },
  {
    id: 3,
    label: "Categorias x",
  },
];

function ContextHeader() {
  return (
    <header className="px-4 pt-10 pb-4">
      <h2 className="text-[22px] font-semibold text-neutral-800">
        O que você deseja monitorar?
      </h2>
      <p className="mt-2 text-sm text-neutral-600">
        Selecione que módulo você deseja analisar
      </p>
    </header>
  );
}

function AccordionItem({
  item,
  open,
  onToggle,
}: {
  item: AccordionItemData;
  open: boolean;
  onToggle: () => void;
}) {
  const hasDatasets = Boolean(item.datasets?.length);
  const isOpen = open && hasDatasets;

  return (
    <div
      className={`
        box-border flex flex-col items-start w-full
        bg-white hover:bg-[#E4E5E2]
        border border-[#EFEFEF] rounded-lg transition-colors duration-150
        ${isOpen ? "px-4 pt-1 pb-4 gap-4" : "px-4 py-1 gap-[10px]"}
      `}
    >
      <button
        type="button"
        onClick={onToggle}
        className="cursor-pointer flex flex-row items-center w-full py-4 gap-[18px] text-left bg-transparent"
        style={{ height: 56 }}
        aria-expanded={isOpen}
      >
        <span
          className="flex-1 text-base font-medium text-[#0F172A]"
          style={{ fontFamily: "Inter", fontStyle: "normal" }}
        >
          {item.label}
        </span>

      <Chevron open={isOpen} from={"down"} to={"up"}/>

      </button>

      {isOpen && (
        <>
          <hr className="w-full border-t border-[#EFEFEF]" />
          {item.datasets!.map((dataset) => (
            <DroughtDataset key={dataset.id} card={dataset} />
          ))}
        </>
      )}
    </div>
  );
}

export function AccordionContext(_props: AccordionContextProps) {
  const [openId, setOpenId] = useState<number | null>(null);

  function handleToggle(id: number) {
    setOpenId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="h-full flex flex-col bg-[#F6F7F6]">
      <ContextHeader />
      <div className="flex-1 overflow-y-auto px-5 pb-8">
        <div className="flex flex-col gap-6">
          {MONITORING_ITEMS.map((item) => (
            <AccordionItem
              key={item.id}
              item={item}
              open={openId === item.id}
              onToggle={() => handleToggle(item.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}