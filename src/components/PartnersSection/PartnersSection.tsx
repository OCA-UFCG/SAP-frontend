"use client";

import Image from "next/image";
import { SectionHeaderI, PartnerI } from "@/utils/interfaces";
import { normalizeContentfulImage } from "@/utils/functions";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/Badge/Badge";

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
        <div className="flex flex-col gap-4 text-center lg:text-left items-center lg:items-start">
          <Badge label={t("badge")} />

          <h2 className="text-2xl md:text-[30px] leading-[36px] tracking-[-0.0075em] font-semibold text-[#292829]">
            {title}
          </h2>

          <p className="text-base font-medium leading-relaxed text-[#292829] whitespace-pre-line">
            {description}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-9 sm:grid-cols-3 lg:grid-cols-5">
          {partners.map((partner) => {
            const translationKey = `partners.${partner.sys.id}`;
            const translatedName = t.has(`${translationKey}.name`)
              ? t(`${translationKey}.name`)
              : partner.name;
            const translatedDescription = t.has(`${translationKey}.description`)
              ? t(`${translationKey}.description`)
              : partner.description;

            return (
              <div
                key={partner.sys.id}
                className="flex min-h-[190px] flex-col overflow-hidden rounded-lg bg-[#989F43]"
              >
                <div className="flex min-h-[43px] items-center justify-center px-4 py-2">
                  <span className="text-center font-inter text-xs font-medium leading-normal text-[#F8F7F8]">
                    {translatedDescription}
                  </span>
                </div>

                <div className="flex flex-1 items-center justify-center bg-white p-6">
                  <Image
                    src={normalizeContentfulImage(partner.image.url)}
                    alt={partner.image.title || translatedName}
                    width={partner.image.width ?? 300}
                    height={partner.image.height ?? 100}
                    className="max-h-[95px] w-auto max-w-full object-contain"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
