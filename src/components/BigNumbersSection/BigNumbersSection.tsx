import { HomeHighlightI } from "@/utils/interfaces";

type Props = {
  items: HomeHighlightI[];
};

/** Faixa marrom logo abaixo do banner com os números do SEDES. */
export const BigNumbersSection = ({ items }: Props) => {
  if (!items.length) return null;

  return (
    <section className="w-full bg-[#4E3935]">
      <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-x-6 px-4 py-10 sm:grid-cols-2 md:px-10 lg:flex lg:px-20">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex flex-col p-4 lg:flex-1 lg:border-r lg:border-[#96755C] lg:last:border-r-0"
          >
            <span className="font-open-sans text-4xl font-extrabold leading-[49px] text-[#CCCF87]">
              {item.value}
            </span>
            <span className="font-open-sans text-base font-bold uppercase leading-[22px] text-[#F8F7F8]">
              {item.label}
            </span>
            <span className="font-open-sans text-sm leading-[19px] text-[#F8F7F8]">
              {item.description}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
};

export default BigNumbersSection;
