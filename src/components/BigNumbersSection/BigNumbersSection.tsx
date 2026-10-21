import { HomeHighlightI } from "@/utils/interfaces";
import { CountUp } from "@/components/HomeMotion/HomeMotion";
import { revealOrder } from "@/components/HomeMotion/revealOrder";

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
        {/* Já nasce com `data-shown`, como o banner: o card está sempre na
            primeira tela, e com o `Reveal` ele ficava em branco até o
            JavaScript carregar (3,5 s num celular com 4G fraco). */}
        <div
          data-shown
          className="grid grid-cols-1 rounded-lg border border-[#EFEFEF] bg-white px-6 shadow-[0_12px_32px_rgba(33,36,15,0.08)] sm:grid-cols-2 lg:flex"
        >
          {items.map((item, index) => (
            <div
              key={item.label}
              style={revealOrder(index)}
              className="reveal-item group relative flex flex-col gap-2 px-4 py-6 lg:flex-1 lg:border-r lg:border-[#B4BA61] lg:last:border-r-0"
            >
              {/* Traço verde que cresce sob o número no hover. */}
              <span
                aria-hidden
                className="absolute inset-x-4 bottom-3 h-0.5 origin-left scale-x-0 rounded-full bg-[#B4BA61] transition-[scale] duration-300 group-hover:scale-x-100"
              />
              <span className="origin-left font-open-sans text-[32px] font-extrabold leading-[44px] text-[#5B612A] transition-[scale,color] duration-300 group-hover:text-[#4F5424] motion-safe:group-hover:scale-110">
                <CountUp value={item.value} />
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
