"use client";

import Image from "next/image";
import { SectionHeaderI, PartnerI } from "@/utils/interfaces";
import { normalizeContentfulImage } from "@/utils/functions";
import { useTranslations } from "next-intl";

type Props = {
  header: SectionHeaderI;
  partners: PartnerI[];
  className?: string;
};

export const PartnersSection = ({
  header,
  partners,
  className = "",
}: Props) => {
  const t = useTranslations("PartnersSection");

  const title = t("title", { title: header.title });
  const description = t("description", { description: header.description });

  return (
    <section className={`w-full min-h-82 bg-[#F6F7F6] ${className}`}>
      <div className="max-w-[1440px] mx-auto px-4 sm:px-10 lg:px-20 py-12 flex flex-col gap-6">
        <div className="flex flex-col gap-6 text-center lg:text-left items-center lg:items-start">
          <h2 className="text-2xl md:text-[30px] leading-[36px] tracking-[-0.0075em] font-semibold text-[#292829]">
            {title}
          </h2>

          <p className="text-base font-medium leading-relaxed text-[#292829] whitespace-pre-line">
            {description}
          </p>
        </div>

        <div className="flex flex-wrap justify-center items-start gap-y-[37px] gap-x-6">
          {partners.map((partner) => (
            <div
              key={partner.sys.id}
              className="flex w-55 flex-col items-center gap-2"
            >
              <span className="text-sm font-bold text-center text-[#292829]">
                {partner.name}
              </span>
              <Image
                src={normalizeContentfulImage(partner.image.url)}
                alt={partner.image.title || partner.name}
                width={partner.image.width ?? 300}
                height={partner.image.height ?? 100}
                className="h-15.5 w-auto object-contain"
              />
              <span className="text-sm text-center text-[#292829]">
                {partner.description}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
