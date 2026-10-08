import Image from "next/image";
import { Link } from "@/translations/routing";
import { PlatformModulesSectionI } from "@/utils/interfaces";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { MODULE_ICONS } from "@/components/HomeIcons/HomeIcons";

type Props = {
  id?: string;
  content: PlatformModulesSectionI;
  className?: string;
};

// Em telas com mouse a descrição só aparece ao passar o mouse (ou focar o
// botão); em telas de toque, que não têm hover, ela já fica aberta.
const SHOW_ON_HOVER =
  "group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:hover)]:opacity-0";

export const PlatformModulesSection = ({
  id,
  content,
  className = "bg-[#F6F7F6]",
}: Props) => {
  const t = useTranslations("PlatformModulesSection");

  return (
    <section
      id={id}
      className={cn("w-full scroll-mt-16.5", className)}
    >
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-12 md:px-10 lg:px-20">
        <h2 className="pb-2 font-open-sans text-[30px] font-semibold leading-9 tracking-[-0.0075em] text-[#292829]">
          {t("title")}
        </h2>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {content.modules.map((module) => {
            const ModuleIcon = MODULE_ICONS[module.id];

            return (
              <article
                key={module.id}
                className="group relative flex h-[420px] flex-col justify-end gap-4 overflow-hidden rounded-md bg-black p-[25px] md:h-[480px]"
              >
                {/* A foto cobre a parte de cima; embaixo o degradê já é preto,
                    e a borda inferior some aos poucos para não marcar a junção. */}
                <div className="absolute inset-x-0 top-0 h-[76%] [mask-image:linear-gradient(to_bottom,#000_70%,transparent)]">
                  <Image
                    src={module.image}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover object-top"
                  />
                </div>
                <div
                  aria-hidden
                  className="absolute inset-0 bg-[linear-gradient(0deg,#000000_11.76%,rgba(102,102,102,0)_102.05%)]"
                />
                <div
                  aria-hidden
                  className={cn(
                    "absolute inset-0 bg-[linear-gradient(0deg,#000000_15.84%,rgba(102,102,102,0)_131.77%)] transition-opacity duration-300",
                    SHOW_ON_HOVER,
                  )}
                />

                <div className="relative flex flex-col text-[#F8F7F8]">
                  <h3 className="flex items-center gap-2 font-open-sans text-[28px] font-extrabold leading-[38px]">
                    <ModuleIcon size={38} className="shrink-0 text-white" />
                    {t(`modules.${module.id}.title`)}
                  </h3>
                  <div className="grid grid-rows-[1fr] transition-[grid-template-rows] duration-300 group-hover:grid-rows-[1fr] group-focus-within:grid-rows-[1fr] [@media(hover:hover)]:grid-rows-[0fr]">
                    <p
                      className={cn(
                        "overflow-hidden font-open-sans text-sm leading-[19px] transition-opacity duration-300",
                        SHOW_ON_HOVER,
                      )}
                    >
                      <span className="block pt-2">
                        {t(`modules.${module.id}.description`)}
                      </span>
                    </p>
                  </div>
                </div>

                <Link
                  href={module.href}
                  className="relative flex w-full items-center justify-center rounded-[4.33px] bg-[#989F43] px-3 py-1.5 font-inter text-[10px] font-medium leading-[17px] text-[#F8F7F8] transition-colors hover:bg-[#7F8639]"
                >
                  {t("access")}
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default PlatformModulesSection;
