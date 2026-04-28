import { FooterI } from "@/utils/interfaces";
import { channels } from "@/utils/constants";
import { sortContentByDesiredOrder } from "@/utils/functions";
import Image from "next/image";
import SocialChannels from "../ContactSection/SocialChannels";

export const Footer = ({ content }: { content: FooterI[] }) => {
  const mainPages = sortContentByDesiredOrder<FooterI>(content, [
    "/",
    "/map",
    "/about",
    "/contact",
  ]).filter((item) => item.appears);

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
            {mainPages.map(({ id, path, name }) => (
              <a
                href={path}
                key={id}
                className="text-sm font-bold leading-5 text-white transition-opacity hover:opacity-60"
              >
                {name}
              </a>
            ))}
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 lg:ml-auto lg:w-auto lg:items-start">
          <div className="flex flex-col gap-3 lg:items-start">
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
