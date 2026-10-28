import Image from "next/image";
import { Link } from "@/translations/routing";
import { HomeTextsI, PlatformModulesSectionI } from "@/utils/interfaces";
import { cn } from "@/lib/utils";
import { MODULE_ICONS } from "@/components/HomeIcons/HomeIcons";
import { Reveal } from "@/components/HomeMotion/HomeMotion";
import { revealOrder } from "@/components/HomeMotion/revealOrder";
import { BlurPreview } from "@/components/BlurPreview/BlurPreview";
import type { BlurPreviews } from "@/services/blurPreviews";

type Props = {
  id?: string;
  content: PlatformModulesSectionI;
  texts: HomeTextsI["tools"];
  /** Prévias borradas das fotos, por endereço (`getBlurPreviews`). */
  previews?: BlurPreviews;
  className?: string;
};

export const PlatformModulesSection = ({
  id,
  content,
  texts,
  previews = {},
  className = "bg-[#E4E5E2]",
}: Props) => {
  return (
    <section
      id={id}
      className={cn("w-full scroll-mt-16.5", className)}
    >
      <Reveal className="mx-auto flex w-full max-w-[1440px] flex-col gap-9 px-4 py-12 md:px-10 lg:px-20">
        <div className="reveal-item flex flex-col gap-2">
          <h2 className="font-open-sans text-[1.875rem] font-semibold leading-9 tracking-[-0.0075em] text-[#292829]">
            {texts.title}
          </h2>
          {texts.subtitle && (
            <p className="font-open-sans text-base leading-6 text-[#292829]">
              {texts.subtitle}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {content.modules.map((module, index) => {
            const ModuleIcon = MODULE_ICONS[module.id];
            const text = texts.items.find((item) => item.id === module.id);
            if (!text) return null;
            const photo = text.image ?? module.image;

            return (
              // O card inteiro sobe e cresce no hover e a foto aproxima, para
              // puxar o olho para o botão.
              <article
                key={module.id}
                style={revealOrder(index + 1)}
                className="reveal-item group flex flex-col overflow-hidden rounded-lg border border-[#EFEFEF] bg-white shadow-sm transition-[translate,scale,box-shadow,border-color] duration-300 ease-out hover:border-[#CCCF87] hover:shadow-[0_20px_40px_rgba(63,67,36,0.18)] motion-safe:hover:-translate-y-2 motion-safe:hover:scale-[1.02]"
              >
                {/* A prévia borrada (ou o cinza, sem ela) ocupa o lugar da foto
                    enquanto ela chega no celular. */}
                <div className="relative h-[258px] w-full shrink-0 overflow-hidden bg-[#E4E5E2]">
                  <BlurPreview src={previews[photo]} />
                  <Image
                    src={photo}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition-[scale] duration-700 ease-out motion-safe:group-hover:scale-110"
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-[linear-gradient(0deg,rgba(63,67,36,0.45),transparent_60%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  />
                </div>

                <div className="flex flex-col gap-4 px-6 pt-4 pb-6 text-[#0F172A]">
                  <h3 className="flex items-center gap-4 font-open-sans text-2xl font-bold leading-[33px] text-[#292829]">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#5B612A] p-1 text-[#F8F7F8]">
                      <ModuleIcon size={32} />
                    </span>
                    {text.name}
                  </h3>
                  <p className="font-inter text-sm leading-6">
                    {text.shortText}
                  </p>
                </div>

                <div className="mt-auto px-6 pt-3 pb-6">
                  <Link
                    href={module.href}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#646B2D] px-4 py-2 font-inter text-sm leading-6 text-[#F8F7F8] transition-[background-color,scale] group-hover:bg-[#4F5424] active:scale-[0.97]"
                  >
                    {text.buttonText}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </Reveal>
    </section>
  );
};

export default PlatformModulesSection;
