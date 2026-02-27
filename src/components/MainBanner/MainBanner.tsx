import { IMainBanner } from "@/utils/interfaces";
import Image from "next/image";

interface MainBannerProps {
  data: IMainBanner;
}

export function MainBanner({ data }: MainBannerProps) {
  if (!data) return null;

  const { title, subtitle, linkText, link, image } = data;
  return (
    <section className="relative w-full min-h-[492px] overflow-hidden">
      <div className="absolute inset-0 w-full h-full z-0 overflow-hidden">
        <Image
          src={image.url}
          alt="Sistema de Alerta Precoce"
          fill
          priority
          unoptimized
          className="object-cover object-center"
        />

        <div
          className="absolute inset-0 z-10"
          style={{
            background:
              "linear-gradient(270deg, rgba(0, 0, 0, 0.05) 19.23%, #4A4E26 65.38%)",
          }}
        />
      </div>

      <div className="absolute opacity-[0.05] left-0 -translate-x-[38%] -translate-y-[32%] pointer-events-none">
        <Image
          src="/solar_icon.png"
          alt=""
          width={750}
          height={750}
          className="max-w-none w-[800px] lg:w-[1000px] h-auto scale-y-75 scale-x-90"
        />
      </div>

      <div className="relative z-20 w-full flex justify-center">
        <div className="w-full max-w-[1440px] mx-auto px-6 py-12 md:px-10 md:py-16 lg:px-[78px] lg:py-[85px] flex items-center min-h-[492px]">
          <div className="w-full">
            <div className="flex flex-col gap-[24px] max-w-[800px] items-start text-left">
              <h1 className="font-open font-[700] text-white text-3xl md:text-5xl lg:text-[64px] leading-tight drop-shadow-sm">
                {title}
              </h1>

              <p className="font-open font-[400] text-white text-base md:text-[16px] leading-relaxed max-w-[600px]">
                {subtitle}
              </p>

              <a
                href={link}
                className="mt-4 flex items-center justify-center w-full md:w-[302px] h-[40px] px-4 py-2 rounded-[8px] bg-[#989F43] hover:bg-[#5B612A] text-white transition-all duration-200 shadow-md"
              >
                <span className="font-open text-[14px] font-[500] leading-[24px] tracking-normal">
                  {linkText}
                </span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
