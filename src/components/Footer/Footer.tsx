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
      <div className="w-full max-w-[1440px] mx-auto px-6 py-12 md:px-10 md:py-16 lg:px-[78px] lg:py-[85px] flex flex-col lg:flex-row justify-between box-border items-top gap-4">
        <div className="flex justify-center w-full lg:w-auto">
          <Image
            width="400"
            height="400"
            src="/logo-sap.png"
            alt="SAP"
            className="h-16 w-auto"
          />
        </div>
        <div className="hidden lg:flex gap-12 w-full lg:w-auto px-4 items-start">
          <div className="flex flex-row items-center lg:items-start gap-15">
            {mainPages.map(({ id, path, name }) => (
              <a
                href={path}
                key={id}
                className="text-white font-bold text-md hover:opacity-60 transition-opacity"
              >
                {name}
              </a>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-between lg:items-start lg:ml-auto w-full lg:w-auto gap-4">
          <div className="flex flex-col lg:items-start gap-4">
            <div className="flex flex-wrap justify-center lg:justify-end">
              <SocialChannels channels={channels} size={32} />
            </div>
            <p className="text-white font-medium text-sm text-center">
              {/* {sapEmail} */}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
