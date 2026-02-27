import { FooterI } from "@/utils/interfaces"
import { Icon } from "@/components/Icon/Icon";
import { channels } from "@/utils/constants";
import { sortContentByDesiredOrder } from "@/utils/functions";
import Image from "next/image"

export const Footer = ({ content }: { content: FooterI[] }) => {
  const mainPages = sortContentByDesiredOrder<FooterI>(content, [
    "home",
    "map",
    "about",
    "contact",
  ]).filter((item) => item.appears);

  return (

    <footer className="flex justify-center w-full bg-[#989F43]">
      <div className="flex flex-col lg:flex-row justify-between max-w-360 box-border items-top px-14 py-14 gap-4 w-full">
        <div className="flex justify-center w-full lg:w-auto">
          <Image
            width= "400"
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
            <div className="flex flex-wrap justify-center lg:justify-end gap-4">
              {channels.map(({ href, icon, size }, index) => (
                <a target="_blank" href={href} key={index}>
                  <Icon
                    id={icon}
                    size={size}
                    key={index}
                    className="text-grey-900"
                  />
                </a>
              ))}
            </div>
            <p className="text-white font-medium text-sm text-center">
              sap.ufcg@gmail.com
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
