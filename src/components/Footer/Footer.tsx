import { FooterI } from "@/utils/interfaces";
import { channels } from "@/utils/constants";
import { sortContentByDesiredOrder } from "@/utils/functions";
import Image from "next/image";
import SocialChannels from "../ContactSection/SocialChannels";
import { useTranslations } from "next-intl";

export const Footer = ({ content }: { content: FooterI[] }) => {
  const t = useTranslations("Footer");

  const mainPages = sortContentByDesiredOrder<FooterI>(content, [
    "/",
    "/about",
    "/map",
  ]).filter((item) => item.appears);

  const pathKeyMap: Record<string, string> = {
    "/": "home",
    "/map": "platform",
    "/about": "about",
    "/contact": "contact",
  };

  return (
    <footer className="flex justify-center w-full bg-[#989F43]">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col items-start justify-between gap-6 box-border px-6 py-10 md:px-10 md:py-12 lg:flex-row lg:gap-[60px] lg:px-20 lg:py-12">
        <div className="flex justify-center w-full lg:w-auto">
          <Image
            width="400"
            height="400"
            src="/logo-sap.png"
            alt="SAP"
            className="h-[57px] w-auto"
          />
        </div>
        <div className="hidden w-full items-start lg:flex lg:min-h-8 lg:flex-1 lg:px-2">
          <div className="flex flex-row items-center gap-6 lg:min-h-8 lg:items-center">
            {mainPages.map(({ id, path, name }) => {
              const href =
                path === "/about"
                  ? "/"
                  : path === "/map"
                    ? "/platform"
                    : path;

              const translationKey = pathKeyMap[path];
              const label = translationKey && t.has(translationKey)
                ? t(translationKey)
                : path === "/map"
                  ? t("platform")
                  : name;

              return (
                <a
                  href={href}
                  key={id}
                  className="text-sm font-bold leading-5 text-white transition-opacity hover:opacity-60"
                >
                  {label}
                </a>
              );
            })}
          </div>
        </div>

        <div className="flex w-full flex-col items-center gap-4 lg:ml-auto lg:w-auto lg:items-end">
          <div className="flex flex-wrap items-center justify-center gap-6 lg:justify-end">
            <Image
              width="2442"
              height="524"
              src="/partners/mma.png"
              alt="Ministério do Meio Ambiente e Mudança do Clima"
              className="h-8 w-auto brightness-0 invert"
            />
            <Image
              width="1485"
              height="755"
              src="/partners/oca.png"
              alt="Observatório da Caatinga e Desertificação"
              className="h-10 w-auto"
            />
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            <div className="flex flex-wrap justify-center lg:justify-end">
              <SocialChannels channels={channels} size={32} />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
