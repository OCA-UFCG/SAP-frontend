import Image from "next/image";
import { useTranslations } from "next-intl";
import { PartnerI } from "@/utils/interfaces";
import { normalizeContentfulImage } from "@/utils/functions";

type Props = {
  id?: string;
  partners: PartnerI[];
};

/** "Instituições que constroem o SEDES": logos dos parceiros do Contentful. */
export const InstitutionsSection = ({ id, partners }: Props) => {
  const t = useTranslations("InstitutionsSection");
  // Nome e papel de cada parceiro já têm tradução na seção antiga.
  const partnersT = useTranslations("PartnersSection");

  if (!partners.length) return null;

  return (
    <section id={id} className="w-full scroll-mt-16.5 bg-[#F6F7F6]">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-12 md:px-10 lg:px-20">
        <h2 className="pb-2 font-inter text-[30px] font-semibold leading-9 tracking-[-0.0075em] text-[#292829]">
          {t("title")}
        </h2>

        <div className="grid grid-cols-2 gap-x-6 gap-y-9 sm:grid-cols-3 lg:grid-cols-5">
          {partners.map((partner) => {
            const key = `partners.${partner.sys.id}`;
            const name = partnersT.has(`${key}.name`)
              ? partnersT(`${key}.name`)
              : partner.name;
            const description = partnersT.has(`${key}.description`)
              ? partnersT(`${key}.description`)
              : partner.description;

            return (
              <div
                key={partner.sys.id}
                className="flex min-h-[190px] flex-col overflow-hidden rounded-lg bg-white"
              >
                <div className="flex min-h-[50px] items-center justify-center bg-[#E4E5E2] px-4 py-2">
                  <span className="text-center font-inter text-xs leading-[18px] text-[#292829]">
                    {description}
                  </span>
                </div>
                <div className="flex flex-1 items-center justify-center p-6">
                  <Image
                    src={normalizeContentfulImage(partner.image.url)}
                    alt={partner.image.title || name}
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

export default InstitutionsSection;
