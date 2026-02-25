import { FooterI } from "@/utils/interfaces"
import { Icon } from "@/components/Icon/Icon";
import { channels } from "@/utils/constants";
import { sortContentByDesiredOrder } from "@/utils/functions";

export const Footer = ({ content }: { content: FooterI[] }) => {
  const mainPages = sortContentByDesiredOrder<FooterI>(content, [
    "home",
    "map",
    "about",
    "contact",
  ]).filter((item) => item.appears);

  const macroThemes = content
    .filter((item) => !item.appears)
    .sort((a, b) => a.name.localeCompare(b.name));

  const splitColumns = <T,>(array: T[], itemsPerColumn: number) => {
    const columns = [];
    for (let i = 0; i < array.length; i += itemsPerColumn) {
      columns.push(array.slice(i, i + itemsPerColumn));
    }

    return columns;
  };

  return (

    <footer className="w-full bg-[#989F43]">
      <div className="flex flex-col lg:flex-row justify-between items-start max-w-360 px-14 py-14 gap-4 w-full mx-auto">
        <div className="flex justify-start w-full lg:w-auto">
          <img
            src="/Group 10.svg"
            alt="SAP"
            className="h-32 w-auto -mt-4"
          />
        </div>
        <div className="hidden lg:flex gap-12 w-full lg:w-auto px-4 items-start">
          <div className="flex flex-col items-center lg:items-start gap-3">
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
          <div className="flex gap-20">
            {splitColumns(macroThemes, 6).map((columnItems, columnIndex) => (
              <div
                key={`column-${columnIndex}`}
                className="flex flex-col lg:items-start gap-3"
              >
                {columnItems.map(({ id, path, name }) => (
                  <a
                    href={path}
                    key={id}
                    className="text-white text-md hover:opacity-60 transition-opacity"
                  >
                    {name}
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-between lg:items-start lg:ml-auto w-full lg:w-auto gap-4">
          <div className="flex flex-col lg:items-start gap-4">
            <p className="hidden lg:flex text-white font-semibold text-2xl">
              Redes sociais e contatos
            </p>
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
              emailsap@oca.com
            </p>
          </div>
          <div className="flex flex-wrap gap-4 justify-center lg:justify-start px-4 lg:px-0 max-w-2xl mx-auto lg:mx-0">
            <Icon
              id="logo-gov"
              className="w-16 h-10 sm:w-32 sm:h-16"
            />
            <Icon
              id="logo-mma"
              className="w-16 h-10 sm:w-32 sm:h-16"
            />{" "}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
