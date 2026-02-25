import Image from "next/image";
import { SectionHeaderI, PartnerI } from "@/utils/interfaces";
import { normalizeContentfulImage } from "@/utils/functions";

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
  return (
    <section className={`w-full min-h-82 bg-[#F6F7F6] ${className}`}>
      <div className="max-w-360 mx-auto px-6 sm:px-10 md:px-20 py-12 flex flex-col">
        <div className="flex flex-col gap-6 max-w-5xl text-center md:text-left items-center md:items-start">
          <h2 className="text-2xl md:text-3xl font-semibold text-[#292829]">
            {header.title}
          </h2>

          <p className="text-base font-medium leading-relaxed text-[#292829] max-w-5xl whitespace-pre-line">
            {header.description}
          </p>
        </div>

        <div className="flex flex-wrap justify-center md:justify-start items-center gap-6 mt-10">
          {partners.map((partner) => (
            <Image
              key={partner.sys.id}
              src={normalizeContentfulImage(partner.image.url)}
              alt={partner.image.title || partner.name}
              width={partner.image.width ?? 300}
              height={partner.image.height ?? 100}
              className="h-15.5 w-auto object-contain"
            />
          ))}
        </div>
      </div>
    </section>
  );
};
