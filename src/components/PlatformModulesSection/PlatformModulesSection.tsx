import Image from "next/image";
import { Link } from "@/translations/routing";
import { PlatformModulesSectionI } from "@/utils/interfaces";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/Badge/Badge";
import { cn } from "@/lib/utils";

type Props = {
  id?: string;
  content: PlatformModulesSectionI;
  className?: string;
};

export const PlatformModulesSection = ({
  id,
  content,
  className = "bg-white",
}: Props) => {
  const t = useTranslations("PlatformModulesSection");
  const footerT = useTranslations("Footer");
  const title = t("title", { title: content.title });

  return (
    <section
      id={id}
      className={cn(
        "w-full scroll-mt-16.5 flex flex-col items-center",
        className,
      )}
    >
      <div className="w-full max-w-[1440px] mx-auto px-4 py-12 md:px-10 lg:px-[80px] flex flex-col gap-6">
        <div className="flex flex-col items-start gap-4">
          <Badge label={footerT("aboutMenu.aPlataforma")} />
          <h2 className="text-[24px] md:text-[28px] lg:text-[30px] leading-[28px] md:leading-[32px] lg:leading-[36px] tracking-[-0.0075em] font-semibold text-[#292829]">
            {title}
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {content.modules.map((module, index) => {
            const moduleTitle = t.has(`modules.${index}.title`)
              ? t(`modules.${index}.title`)
              : module.title;
            const description = t.has(`modules.${index}.description`)
              ? t(`modules.${index}.description`)
              : module.description;

            return (
              <article
                key={`${module.title}-${index}`}
                className="relative flex min-h-[190px] flex-col justify-end gap-4 overflow-hidden rounded-md bg-[#292829] p-6 text-left"
              >
                {module.image && (
                  <Image
                    src={module.image}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 140vw, (max-width: 1024px) 70vw, 46vw"
                    className="object-cover"
                    style={{
                      objectPosition: module.imagePosition ?? "50% 50%",
                      transform: module.imageZoom
                        ? `scale(${module.imageZoom})`
                        : undefined,
                      transformOrigin: "left center",
                    }}
                  />
                )}
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-r from-black from-[34%] to-[#666666]/0 to-[114%]"
                />

                <div className="relative flex flex-col gap-2 text-[#F8F7F8]">
                  <h3 className="text-[28px] font-extrabold leading-tight">
                    {moduleTitle}
                  </h3>
                  <p className="text-xs leading-normal">{description}</p>
                </div>

                {module.href && (
                  <Link
                    href={module.href}
                    className="relative flex w-full items-center justify-center rounded bg-[#989F43] px-4 py-2 text-sm font-medium text-[#F8F7F8] transition-colors hover:bg-[#7F8639]"
                  >
                    {t("learnMore")}
                  </Link>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default PlatformModulesSection;
