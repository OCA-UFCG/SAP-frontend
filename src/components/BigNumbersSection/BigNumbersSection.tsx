import { HomeHighlightI } from "@/utils/interfaces";

type Props = {
  items: HomeHighlightI[];
};

/** Card branco com os números do SEDES, subindo 80 px por cima do banner. */
export const BigNumbersSection = ({ items }: Props) => {
  if (!items.length) return null;

  // A seção sobe 80 px e o cinza só começa abaixo deles, para o banner
  // continuar visível dos dois lados do card.
  return (
    <section className="relative z-30 -mt-20 w-full bg-[linear-gradient(transparent_80px,#E4E5E2_80px)]">
      <div className="mx-auto w-full max-w-[1440px] px-4 md:px-10 lg:px-20">
        <div className="grid grid-cols-1 rounded-lg border border-[#EFEFEF] bg-white px-6 sm:grid-cols-2 lg:flex">
          {items.map((item) => (
            <div
              key={item.label}
              className="flex flex-col gap-2 px-4 py-6 lg:flex-1 lg:border-r lg:border-[#B4BA61] lg:last:border-r-0"
            >
              <span className="font-open-sans text-[32px] font-extrabold leading-[44px] text-[#777E32]">
                {item.value}
              </span>
              <div className="flex flex-col font-open-sans">
                <span className="text-base font-bold uppercase leading-[22px] text-[#292829]">
                  {item.label}
                </span>
                <span className="text-sm leading-[19px] text-[#0F172A]">
                  {item.description}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BigNumbersSection;
